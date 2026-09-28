import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../../src/db/database.js";
import { createApplication } from "../../src/domain/applications/application-service.js";
import { ingestEvent } from "../../src/domain/events/event-service.js";
import { createPricing, listPricing, getMissingPricingModels } from "../../src/domain/pricing/pricing-service.js";

let db: Database.Database;

const basePricing = {
  provider: "openai",
  model: "gpt-4",
  inputPricePerMillion: "3.0",
  cachedInputPricePerMillion: "1.5",
  outputPricePerMillion: "6.0",
  validFrom: "2026-01-01T00:00:00.000Z",
};

const baseEvent = {
  eventId: "00000000-0000-4000-8000-000000000001",
  timestamp: "2026-09-09T12:00:00.000Z",
  durationMs: 1000,
  environment: "production",
  feature: "feat",
  operation: "op",
  operationId: "op-id",
  attemptNumber: 1,
  status: "success" as const,
  provider: "openai",
  requestedModel: "gpt-4",
};

beforeEach(() => {
  db = createTestDb();
  createApplication(db, "app-1", "App One");
});

describe("listPricing", () => {
  it("returns empty list initially", () => {
    expect(listPricing(db)).toHaveLength(0);
  });

  it("lists created pricing records", () => {
    createPricing(db, basePricing);
    createPricing(db, { ...basePricing, provider: "anthropic", model: "claude-3" });
    const records = listPricing(db);
    expect(records).toHaveLength(2);
    expect(records.map((r) => r.provider)).toContain("openai");
    expect(records.map((r) => r.provider)).toContain("anthropic");
  });
});

describe("getMissingPricingModels", () => {
  it("returns models present in events but not priced", () => {
    ingestEvent(db, baseEvent, "app-1");
    const missing = getMissingPricingModels(db);
    expect(missing).toHaveLength(1);
    expect(missing[0]!.provider).toBe("openai");
    expect(missing[0]!.model).toBe("gpt-4");
    expect(missing[0]!.eventCount).toBe(1);
  });

  it("does not include models that have pricing", () => {
    ingestEvent(db, baseEvent, "app-1");
    createPricing(db, basePricing);
    const missing = getMissingPricingModels(db);
    expect(missing).toHaveLength(0);
  });

  it("counts events per model correctly", () => {
    ingestEvent(db, baseEvent, "app-1");
    ingestEvent(db, { ...baseEvent, eventId: "00000000-0000-4000-8000-000000000002" }, "app-1");
    const missing = getMissingPricingModels(db);
    expect(missing[0]!.eventCount).toBe(2);
  });

  it("uses reportedModel if present", () => {
    ingestEvent(db, { ...baseEvent, reportedModel: "gpt-4-actual" }, "app-1");
    const missing = getMissingPricingModels(db);
    expect(missing[0]!.model).toBe("gpt-4-actual");
  });

  it("distinguishes different providers", () => {
    ingestEvent(db, baseEvent, "app-1");
    ingestEvent(db, {
      ...baseEvent,
      eventId: "00000000-0000-4000-8000-000000000002",
      provider: "anthropic",
      requestedModel: "claude-3",
    }, "app-1");
    const missing = getMissingPricingModels(db);
    expect(missing).toHaveLength(2);
  });
});
