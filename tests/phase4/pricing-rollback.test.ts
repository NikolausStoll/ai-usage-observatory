import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../../src/db/database.js";
import { createApplication } from "../../src/domain/applications/application-service.js";
import { ingestEvent } from "../../src/domain/events/event-service.js";
import { createPricing, listPricing } from "../../src/domain/pricing/pricing-service.js";

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
  createApplication(db, "app-1", "App One");
});

describe("createPricing transaction rollback", () => {
  it("rolls back pricing insertion when recalculation fails", () => {
    // Drop events table to force a SQL error during recalculation
    db.prepare("ALTER TABLE events RENAME TO events_backup").run();

    const before = listPricing(db);
    expect(before).toHaveLength(0);

    expect(() =>
      createPricing(db, {
        provider: "openai",
        model: "gpt-4",
        inputPricePerMillion: "3.0",
        cachedInputPricePerMillion: "1.5",
        outputPricePerMillion: "6.0",
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: null,
      })
    ).toThrow();

    // Pricing record must NOT have been inserted (transaction rolled back)
    db.prepare("ALTER TABLE events_backup RENAME TO events").run();
    const after = listPricing(db);
    expect(after).toHaveLength(0);
  });

  it("creates pricing and recalculates atomically in one transaction when no failure", () => {
    // Ingest event first
    ingestEvent(db, {
      eventId: "00000000-0000-4000-8000-000000000001",
      timestamp: "2026-09-09T12:00:00.000Z",
      durationMs: 100,
      environment: "production",
      feature: "f",
      operation: "op",
      operationId: "op-1",
      attemptNumber: 1,
      status: "success",
      provider: "openai",
      requestedModel: "gpt-4",
      usage: { inputTokens: 1000, outputTokens: 500, cachedInputTokens: null, reasoningTokens: null, totalTokens: 1500 },
    }, "app-1");

    // No pricing yet
    const eventBefore = db.prepare("SELECT total_cost, pricing_id FROM events").get() as { total_cost: string | null; pricing_id: string | null };
    expect(eventBefore.total_cost).toBeNull();
    expect(eventBefore.pricing_id).toBeNull();

    // Create pricing — should also recalculate the existing event atomically
    createPricing(db, {
      provider: "openai",
      model: "gpt-4",
      inputPricePerMillion: "3.0",
      cachedInputPricePerMillion: "1.5",
      outputPricePerMillion: "6.0",
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: null,
    });

    const eventAfter = db.prepare("SELECT total_cost, pricing_id FROM events").get() as { total_cost: string | null; pricing_id: string | null };
    expect(eventAfter.total_cost).not.toBeNull();
    expect(eventAfter.pricing_id).not.toBeNull();
  });
});
