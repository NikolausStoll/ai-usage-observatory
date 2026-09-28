import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { setupTestDb, createTestApp, makeEvent, stdPricing } from "../helpers.js";
import { createPricing } from "../../src/domain/pricing/pricing-service.js";
import { ingestEvent } from "../../src/domain/events/event-service.js";

let db: Database.Database;

function getEventRow(eventId: string) {
  return db.prepare("SELECT * FROM events WHERE event_id = ?").get(eventId) as Record<string, unknown>;
}

beforeEach(() => {
  db = setupTestDb();
  createTestApp(db);
  // Pre-create standard pricing
  createPricing(db, stdPricing);
});

describe("cost calculation", () => {
  it("calculates normal input cost", () => {
    const event = makeEvent({
      usage: { inputTokens: 1000000, cachedInputTokens: 0, outputTokens: 0 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    // 1M tokens * $30/M = $30.00
    expect(row["input_cost"]).toBe("30.0000000000");
    expect(row["cached_input_cost"]).toBe("0.0000000000");
    expect(row["output_cost"]).toBe("0.0000000000");
    expect(row["total_cost"]).toBe("30.0000000000");
    expect(row["pricing_id"]).toBeTruthy();
  });

  it("calculates cached input cost correctly (uncached = input - cached)", () => {
    const event = makeEvent({
      usage: {
        inputTokens: 1000000,
        cachedInputTokens: 600000,
        outputTokens: 0,
      },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    // uncached = 1M - 600k = 400k tokens * $30/M = $12
    // cached = 600k * $15/M = $9
    // total = $21
    expect(row["input_cost"]).toBe("12.0000000000");
    expect(row["cached_input_cost"]).toBe("9.0000000000");
    expect(row["total_cost"]).toBe("21.0000000000");
  });

  it("calculates output cost", () => {
    const event = makeEvent({
      usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 500000 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    // 500k * $60/M = $30
    expect(row["output_cost"]).toBe("30.0000000000");
    expect(row["total_cost"]).toBe("30.0000000000");
  });

  it("null cachedInputTokens treated as 0 for cost, remains null in DB", () => {
    const event = makeEvent({
      usage: { inputTokens: 1000000, cachedInputTokens: null, outputTokens: 0 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    // null cached → all 1M treated as uncached: 1M * $30 = $30
    expect(row["cached_input_tokens"]).toBeNull();
    expect(row["input_cost"]).toBe("30.0000000000");
    expect(row["cached_input_cost"]).toBe("0.0000000000");
    expect(row["total_cost"]).toBe("30.0000000000");
  });

  it("null inputTokens treated as 0 for cost, remains null in DB", () => {
    const event = makeEvent({
      usage: { inputTokens: null, cachedInputTokens: null, outputTokens: 100000 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    expect(row["input_tokens"]).toBeNull();
    // output: 100k * $60/M = $6
    expect(row["output_cost"]).toBe("6.0000000000");
    expect(row["total_cost"]).toBe("6.0000000000");
  });

  it("error event can have non-zero cost", () => {
    const event = makeEvent({
      status: "error" as const,
      usage: { inputTokens: 500000, cachedInputTokens: 0, outputTokens: 200000 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    // input: 500k * $30/M = $15, output: 200k * $60/M = $12, total = $27
    expect(row["input_cost"]).toBe("15.0000000000");
    expect(row["output_cost"]).toBe("12.0000000000");
    expect(row["total_cost"]).toBe("27.0000000000");
  });

  it("event with no usage estimates zero cost when pricing exists", () => {
    const event = makeEvent({ usage: undefined });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    expect(row["input_cost"]).toBe("0.0000000000");
    expect(row["output_cost"]).toBe("0.0000000000");
    expect(row["total_cost"]).toBe("0.0000000000");
    expect(row["pricing_id"]).toBeTruthy();
  });

  it("reportedModel takes precedence over requestedModel for pricing", () => {
    // Create pricing for "gpt-4-turbo" (reportedModel)
    createPricing(db, {
      provider: "openai",
      model: "gpt-4-turbo",
      inputPricePerMillion: "10",
      cachedInputPricePerMillion: "5",
      outputPricePerMillion: "30",
      validFrom: "2026-01-01T00:00:00.000Z",
    });

    const event = makeEvent({
      requestedModel: "gpt-4",
      reportedModel: "gpt-4-turbo",
      usage: { inputTokens: 1000000, cachedInputTokens: 0, outputTokens: 0 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    // Should use gpt-4-turbo pricing: $10/M not $30/M
    expect(row["input_cost"]).toBe("10.0000000000");
  });

  it("uses requestedModel when reportedModel absent", () => {
    const event = makeEvent({
      requestedModel: "gpt-4",
      reportedModel: undefined,
      usage: { inputTokens: 1000000, cachedInputTokens: 0, outputTokens: 0 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    // gpt-4 pricing at $30/M
    expect(row["input_cost"]).toBe("30.0000000000");
  });

  it("event without matching pricing stores null costs", () => {
    const event = makeEvent({
      provider: "unknown-provider",
      requestedModel: "unknown-model",
      usage: { inputTokens: 1000, cachedInputTokens: 0, outputTokens: 500 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    expect(row["input_cost"]).toBeNull();
    expect(row["total_cost"]).toBeNull();
    expect(row["pricing_id"]).toBeNull();
  });

  it("cached input exceeding total input does not produce negative uncached cost", () => {
    // cachedInputTokens > inputTokens - uncached should be max(0, ...)
    const event = makeEvent({
      usage: { inputTokens: 100, cachedInputTokens: 200, outputTokens: 0 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = getEventRow(event.eventId);
    // uncached = max(100-200, 0) = 0
    // cached = 200 * $15/M
    expect(row["input_cost"]).toBe("0.0000000000");
    expect(Number(row["cached_input_cost"])).toBeGreaterThan(0);
  });
});
