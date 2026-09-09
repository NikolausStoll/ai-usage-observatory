import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb, createTestApp, createTestApiKey, validEvent, validErrorEvent } from "./helpers.js";
import { ingestEvent, getEvent } from "../../src/domain/events/event-service.js";
import { IngestEventSchema } from "../../src/domain/events/event-schema.js";
import type Database from "better-sqlite3";

let db: Database.Database;

beforeEach(() => {
  db = setupTestDb();
  createTestApp(db);
});

describe("event ingestion", () => {
  it("ingests a valid event", () => {
    const result = ingestEvent(db, validEvent, "test-app");
    expect(result.eventId).toBe(validEvent.eventId);
    expect(result.received).toBe(true);
    expect(result.duplicate).toBe(false);
  });

  it("stores application_id from server, not from client", () => {
    ingestEvent(db, validEvent, "test-app");
    const stored = db.prepare("SELECT application_id FROM events WHERE event_id = ?")
      .get(validEvent.eventId) as { application_id: string };
    expect(stored.application_id).toBe("test-app");
  });

  it("stores all core event fields correctly", () => {
    ingestEvent(db, validEvent, "test-app");
    const row = getEvent(db, validEvent.eventId);
    expect(row).not.toBeNull();
    expect(row!["event_id"]).toBe(validEvent.eventId);
    expect(row!["environment"]).toBe("production");
    expect(row!["feature"]).toBe("recipe-import");
    expect(row!["operation"]).toBe("image-extraction");
    expect(row!["operation_id"]).toBe("recipe-import:123:image-extraction");
    expect(row!["workflow_id"]).toBe("recipe-import:123");
    expect(row!["attempt_number"]).toBe(1);
    expect(row!["status"]).toBe("success");
    expect(row!["provider"]).toBe("openai");
    expect(row!["requested_model"]).toBe("example-model");
    expect(row!["reported_model"]).toBe("example-model-2026-09-01");
    expect(row!["prompt_id"]).toBe("recipe-image-extraction");
    expect(row!["prompt_version"]).toBe("14");
    expect(row!["duration_ms"]).toBe(1843);
    expect(row!["received_at"]).toBeDefined();
  });

  it("stores token usage fields correctly", () => {
    ingestEvent(db, validEvent, "test-app");
    const row = db.prepare("SELECT * FROM events WHERE event_id = ?")
      .get(validEvent.eventId) as Record<string, unknown>;
    expect(row["input_tokens"]).toBe(1200);
    expect(row["cached_input_tokens"]).toBe(800);
    expect(row["output_tokens"]).toBe(300);
    expect(row["reasoning_tokens"]).toBe(120);
    expect(row["total_tokens"]).toBe(1500);
  });

  it("stores null token values as null", () => {
    ingestEvent(db, validErrorEvent, "test-app");
    const row = db.prepare("SELECT * FROM events WHERE event_id = ?")
      .get(validErrorEvent.eventId) as Record<string, unknown>;
    expect(row["cached_input_tokens"]).toBeNull();
    expect(row["reasoning_tokens"]).toBeNull();
  });

  it("stores extensible JSON (metadata, metrics, raw) with round-trip fidelity", () => {
    ingestEvent(db, validEvent, "test-app");
    const row = getEvent(db, validEvent.eventId)!;
    expect(row["metadata"]).toEqual({ importSource: "photo" });
    expect(row["metrics"]).toEqual({ confidence: 0.94, ingredientCount: 12 });
    expect(row["request_input"]).toEqual({ instruction: "Extract the recipe from the supplied image." });
    expect(row["request_raw"]).toEqual({ example: "provider request representation" });
    expect(row["response_output"]).toEqual({ title: "Example Recipe" });
    expect(row["raw_usage"]).toEqual({ example: "provider-native usage representation" });
    expect(row["request_config"]).toEqual({ reasoningEffort: "medium" });
  });

  it("ingests error event with usage and response info", () => {
    const result = ingestEvent(db, validErrorEvent, "test-app");
    expect(result.received).toBe(true);
    const row = getEvent(db, validErrorEvent.eventId)!;
    expect(row["status"]).toBe("error");
    expect(row["http_status"]).toBe(200);
    expect(row["error_type"]).toBe("schema_validation");
    expect(row["error_message"]).toBe("AI response could not be used by the application");
    expect(row["error_metadata"]).toEqual({ validationErrors: 2 });
    expect(row["input_tokens"]).toBe(900);
    expect(row["output_tokens"]).toBe(210);
  });

  it("cost columns are null (Phase 2 not implemented)", () => {
    ingestEvent(db, validEvent, "test-app");
    const row = db.prepare("SELECT input_cost, cached_input_cost, output_cost, total_cost, pricing_id FROM events WHERE event_id = ?")
      .get(validEvent.eventId) as Record<string, unknown>;
    expect(row["input_cost"]).toBeNull();
    expect(row["total_cost"]).toBeNull();
    expect(row["pricing_id"]).toBeNull();
  });
});

describe("event schema validation", () => {
  it("accepts a valid event", () => {
    const result = IngestEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it("rejects missing eventId", () => {
    const { eventId: _, ...rest } = validEvent;
    const result = IngestEventSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid UUID for eventId", () => {
    const result = IngestEventSchema.safeParse({ ...validEvent, eventId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid ISO8601 timestamp", () => {
    const result = IngestEventSchema.safeParse({ ...validEvent, timestamp: "2026-09-09" });
    expect(result.success).toBe(false);
  });

  it("rejects negative durationMs", () => {
    const result = IngestEventSchema.safeParse({ ...validEvent, durationMs: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects attemptNumber below 1", () => {
    const result = IngestEventSchema.safeParse({ ...validEvent, attemptNumber: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = IngestEventSchema.safeParse({ ...validEvent, status: "pending" });
    expect(result.success).toBe(false);
  });

  it("rejects negative inputTokens", () => {
    const result = IngestEventSchema.safeParse({
      ...validEvent,
      usage: { ...validEvent.usage, inputTokens: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative outputTokens", () => {
    const result = IngestEventSchema.safeParse({
      ...validEvent,
      usage: { ...validEvent.usage, outputTokens: -50 },
    });
    expect(result.success).toBe(false);
  });

  it("accepts null token values", () => {
    const result = IngestEventSchema.safeParse({
      ...validEvent,
      usage: { ...validEvent.usage, cachedInputTokens: null, reasoningTokens: null },
    });
    expect(result.success).toBe(true);
  });

  it("accepts missing optional fields", () => {
    const minimal = {
      eventId: "0199c9f2-9f16-7abc-8def-000000000001",
      timestamp: "2026-09-09T12:00:00.000Z",
      durationMs: 100,
      environment: "test",
      feature: "test-feature",
      operation: "test-op",
      operationId: "test-op-1",
      attemptNumber: 1,
      status: "success",
      provider: "anthropic",
      requestedModel: "claude-3",
    };
    const result = IngestEventSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});
