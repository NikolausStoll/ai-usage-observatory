import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { setupTestDb, createTestApp, makeEvent, stdPricing } from "./helpers.js";
import {
  createPricing,
  updatePricing,
} from "../../src/domain/pricing/pricing-service.js";
import { ingestEvent } from "../../src/domain/events/event-service.js";
import type { CreatePricing } from "../../src/domain/pricing/pricing-schema.js";

let db: Database.Database;

function getEventRow(eventId: string) {
  return db.prepare("SELECT * FROM events WHERE event_id = ?").get(eventId) as Record<string, unknown>;
}

beforeEach(() => {
  db = setupTestDb();
  createTestApp(db);
});

describe("pricing recalculation", () => {
  it("events without pricing have null costs", () => {
    const event = makeEvent({
      usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 500 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    expect(row["total_cost"]).toBeNull();
    expect(row["pricing_id"]).toBeNull();
  });

  it("adding pricing retroactively prices existing events", () => {
    const event = makeEvent({
      usage: { inputTokens: 1000000, cachedInputTokens: 0, outputTokens: 0 },
    });
    ingestEvent(db, event as any, "test-app");

    // Verify no cost yet
    expect(getEventRow(event.eventId)["total_cost"]).toBeNull();

    // Add pricing
    createPricing(db, stdPricing);

    // Verify cost now set
    const row = getEventRow(event.eventId);
    expect(row["total_cost"]).toBe("30.0000000000");
    expect(row["pricing_id"]).toBeTruthy();
  });

  it("correcting pricing recalculates affected events", () => {
    const event = makeEvent({
      usage: { inputTokens: 1000000, cachedInputTokens: 0, outputTokens: 0 },
    });
    ingestEvent(db, event as any, "test-app");
    const pricing = createPricing(db, stdPricing);

    // Verify initial cost: $30
    expect(getEventRow(event.eventId)["total_cost"]).toBe("30.0000000000");

    // Correct pricing to $20/M
    updatePricing(db, pricing.id, { inputPricePerMillion: "20" });

    // Cost should be recalculated to $20
    expect(getEventRow(event.eventId)["total_cost"]).toBe("20.0000000000");
  });

  it("only events in the pricing window are recalculated", () => {
    const inWindowEvent = makeEvent({
      timestamp: "2026-06-01T00:00:00.000Z",
      usage: { inputTokens: 1000000, cachedInputTokens: 0, outputTokens: 0 },
    });
    const outOfWindowEvent = makeEvent({
      timestamp: "2025-12-01T00:00:00.000Z", // before validFrom
      usage: { inputTokens: 1000000, cachedInputTokens: 0, outputTokens: 0 },
    });

    ingestEvent(db, inWindowEvent as any, "test-app");
    ingestEvent(db, outOfWindowEvent as any, "test-app");

    createPricing(db, {
      ...stdPricing,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: null,
    });

    const inRow = getEventRow(inWindowEvent.eventId);
    const outRow = getEventRow(outOfWindowEvent.eventId);

    expect(inRow["total_cost"]).toBe("30.0000000000");
    expect(outRow["total_cost"]).toBeNull();
  });

  it("events at validUntil boundary are not recalculated", () => {
    const atBoundaryEvent = makeEvent({
      timestamp: "2026-06-01T00:00:00.000Z",
      usage: { inputTokens: 1000000, cachedInputTokens: 0, outputTokens: 0 },
    });
    ingestEvent(db, atBoundaryEvent as any, "test-app");

    createPricing(db, {
      ...stdPricing,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-06-01T00:00:00.000Z", // half-open: event AT validUntil is excluded
    });

    const row = getEventRow(atBoundaryEvent.eventId);
    expect(row["total_cost"]).toBeNull();
  });

  it("multiple events are all recalculated when pricing changes", () => {
    const events = Array.from({ length: 5 }, () =>
      makeEvent({ usage: { inputTokens: 100000, cachedInputTokens: 0, outputTokens: 0 } })
    );
    for (const e of events) ingestEvent(db, e as any, "test-app");

    const pricing = createPricing(db, stdPricing);
    // Each should be $3 (100k * $30/M)
    for (const e of events) {
      expect(getEventRow(e.eventId)["total_cost"]).toBe("3.0000000000");
    }

    updatePricing(db, pricing.id, { inputPricePerMillion: "10" });
    // Each should now be $1
    for (const e of events) {
      expect(getEventRow(e.eventId)["total_cost"]).toBe("1.0000000000");
    }
  });
});
