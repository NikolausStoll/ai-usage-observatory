/**
 * Cross-cutting acceptance tests — covers spec §24 gaps not covered by domain suites.
 * Focuses on: §24.4 (error with HTTP 200), §24.6 (no-usage zero cost),
 * §24.10 (persistence/clean migration), and startup sequence verification.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import type { Database as DBType } from "better-sqlite3";
import { createTestDb, initDb } from "../../src/db/database.js";
import { createApplication, createApiKey } from "../../src/domain/applications/application-service.js";
import { generateApiKey, hashApiKey } from "../../src/domain/auth/auth.js";
import { ingestEvent } from "../../src/domain/events/event-service.js";
import { createPricing } from "../../src/domain/pricing/pricing-service.js";
import { uploadArtifact } from "../../src/domain/artifacts/artifact-service.js";

function setupDb(): DBType {
  const db = createTestDb();
  createApplication(db, "test-app", "Test App");
  return db;
}

function makeApiKey(db: DBType, appId = "test-app") {
  const raw = generateApiKey();
  const hash = hashApiKey(raw);
  createApiKey(db, appId, "key", hash);
  return raw;
}

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: randomUUID(),
    timestamp: "2026-09-09T12:00:00.000Z",
    durationMs: 1000,
    environment: "production",
    feature: "test",
    operation: "test-op",
    operationId: "op-1",
    attemptNumber: 1,
    status: "success" as const,
    provider: "openai",
    requestedModel: "gpt-4",
    ...overrides,
  };
}

// ─── §24.4 Status/error behavior ────────────────────────────────────────────

describe("§24.4 status and error behavior", () => {
  let db: DBType;
  beforeEach(() => { db = setupDb(); });

  it("successful attempt with usage stored correctly", () => {
    const event = baseEvent({
      status: "success",
      usage: { inputTokens: 500, outputTokens: 100, totalTokens: 600 },
    });
    const result = ingestEvent(db, event as any, "test-app");
    expect(result.received).toBe(true);
    const row = db.prepare("SELECT * FROM events WHERE event_id = ?").get(event.eventId) as Record<string, unknown>;
    expect(row["status"]).toBe("success");
    expect(row["input_tokens"]).toBe(500);
  });

  it("error without usage — all token fields null", () => {
    const event = baseEvent({
      status: "error",
      error: { type: "timeout", message: "Request timed out" },
    });
    ingestEvent(db, event as any, "test-app");
    const row = db.prepare("SELECT * FROM events WHERE event_id = ?").get(event.eventId) as Record<string, unknown>;
    expect(row["status"]).toBe("error");
    expect(row["input_tokens"]).toBeNull();
    expect(row["output_tokens"]).toBeNull();
    expect(row["error_type"]).toBe("timeout");
    expect(row["error_message"]).toBe("Request timed out");
  });

  it("error with usage — usage retained, cost can be non-zero", () => {
    createPricing(db, {
      provider: "openai",
      model: "gpt-4",
      inputPricePerMillion: "30",
      cachedInputPricePerMillion: "15",
      outputPricePerMillion: "60",
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: null,
    });
    const event = baseEvent({
      status: "error",
      httpStatus: 200,
      error: { type: "schema_validation", message: "AI response unusable" },
      usage: { inputTokens: 1000, outputTokens: 300, totalTokens: 1300 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = db.prepare("SELECT * FROM events WHERE event_id = ?").get(event.eventId) as Record<string, unknown>;
    expect(row["status"]).toBe("error");
    expect(row["http_status"]).toBe(200);
    expect(row["input_tokens"]).toBe(1000);
    // Error event with usage should have non-null cost when pricing exists
    expect(row["total_cost"]).not.toBeNull();
    const totalCost = parseFloat(row["total_cost"] as string);
    expect(totalCost).toBeGreaterThan(0);
  });

  it("error with HTTP 200 (provider returned 200 but response unusable) — §24.4 explicit", () => {
    const event = baseEvent({
      status: "error",
      httpStatus: 200,
      error: {
        type: "schema_validation",
        message: "AI response could not be used by the application",
        metadata: { validationErrors: 2 },
      },
      response: { output: { unexpected: "shape" } },
      usage: {
        inputTokens: 900,
        cachedInputTokens: null,
        outputTokens: 210,
        totalTokens: 1110,
        rawUsage: {},
      },
    });
    ingestEvent(db, event as any, "test-app");
    const row = db.prepare("SELECT * FROM events WHERE event_id = ?").get(event.eventId) as Record<string, unknown>;
    expect(row["status"]).toBe("error");
    expect(row["http_status"]).toBe(200);
    expect(row["error_type"]).toBe("schema_validation");
    expect(row["input_tokens"]).toBe(900);
    expect(row["cached_input_tokens"]).toBeNull();
  });
});

// ─── §24.6 Cost — no-usage events ───────────────────────────────────────────

describe("§24.6 cost — no usage edge cases", () => {
  let db: DBType;
  beforeEach(() => {
    db = setupDb();
    createPricing(db, {
      provider: "openai",
      model: "gpt-4",
      inputPricePerMillion: "30",
      cachedInputPricePerMillion: "15",
      outputPricePerMillion: "60",
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: null,
    });
  });

  it("event with no usage field estimates zero cost when pricing exists", () => {
    const event = baseEvent({ usage: undefined });
    ingestEvent(db, event as any, "test-app");
    const row = db.prepare("SELECT * FROM events WHERE event_id = ?").get(event.eventId) as Record<string, unknown>;
    expect(row["input_tokens"]).toBeNull();
    expect(row["output_tokens"]).toBeNull();
    expect(row["total_cost"]).toBe("0.0000000000");
    expect(row["pricing_id"]).not.toBeNull();
  });

  it("event with all-null token fields estimates zero cost", () => {
    const event = baseEvent({
      usage: {
        inputTokens: null,
        cachedInputTokens: null,
        outputTokens: null,
        reasoningTokens: null,
        totalTokens: null,
      },
    });
    ingestEvent(db, event as any, "test-app");
    const row = db.prepare("SELECT * FROM events WHERE event_id = ?").get(event.eventId) as Record<string, unknown>;
    expect(row["total_cost"]).toBe("0.0000000000");
  });
});

// ─── §24.10 Persistence — migrations from clean DB ──────────────────────────

describe("§24.10 persistence", () => {
  it("migrations run from a clean (empty) database and create all tables", () => {
    const db = createTestDb();
    // Verify all expected tables exist
    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("applications");
    expect(tableNames).toContain("api_keys");
    expect(tableNames).toContain("events");
    expect(tableNames).toContain("pricing");
    expect(tableNames).toContain("artifacts");
    expect(tableNames).toContain("schema_migrations");
  });

  it("migrations track versions in schema_migrations when using initDb", () => {
    const tempDir = join(tmpdir(), `obs-test-migrations-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });
    const db = initDb(join(tempDir, "observatory.sqlite"));
    const versions = db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: number }>;
    expect(versions.length).toBe(2);
    expect(versions[0]!.version).toBe(1);
    expect(versions[1]!.version).toBe(2);
    db.close();
  });

  it("data persists across multiple operations (restart simulation)", () => {
    const tempDir = join(tmpdir(), `obs-test-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });

    // First "start" — create app and ingest event
    const db1 = initDb(join(tempDir, "observatory.sqlite"));
    createApplication(db1, "persist-app", "Persist App");
    ingestEvent(db1, baseEvent({ provider: "anthropic", requestedModel: "claude" }) as any, "persist-app");
    db1.close();
    (require as any).__db_reset?.(); // reset singleton if any

    // Second "start" — data should still be there
    const db2 = new Database(join(tempDir, "observatory.sqlite"));
    const app = db2.prepare("SELECT * FROM applications WHERE id = ?").get("persist-app") as Record<string, unknown> | undefined;
    expect(app).toBeDefined();
    expect(app!["display_name"]).toBe("Persist App");
    const evtCount = (db2.prepare("SELECT COUNT(*) as cnt FROM events").get() as { cnt: number }).cnt;
    expect(evtCount).toBe(1);
    db2.close();
  });

  it("artifact binary stored on filesystem, not in SQLite", async () => {
    const tempDir = join(tmpdir(), `obs-test-${randomUUID()}`);
    mkdirSync(tempDir, { recursive: true });
    mkdirSync(join(tempDir, "artifacts"), { recursive: true });

    const db = createTestDb();
    createApplication(db, "art-app", "Artifact App");
    ingestEvent(db, baseEvent() as any, "art-app");
    const eventId = (db.prepare("SELECT event_id FROM events LIMIT 1").get() as { event_id: string }).event_id;

    const { FileSystemArtifactStorage } = await import("../../src/domain/artifacts/artifact-storage.js");
    const storage = new FileSystemArtifactStorage(join(tempDir, "artifacts"));
    const data = Buffer.from("binary artifact content for persistence test");

    const result = await uploadArtifact(db, storage, {
      eventId,
      role: "input",
      mimeType: "application/octet-stream",
      data,
    });

    // File exists on filesystem
    const filePath = join(tempDir, "artifacts", result.artifactId);
    expect(existsSync(filePath)).toBe(true);

    // DB row doesn't contain the binary
    const dbRow = db.prepare("SELECT * FROM artifacts WHERE artifact_id = ?").get(result.artifactId) as Record<string, unknown>;
    expect(dbRow["content_hash"]).toBeDefined();
    // No binary blob column exists
    expect(Object.values(dbRow).some((v) => Buffer.isBuffer(v))).toBe(false);
  });
});

// ─── §24.3 Idempotency — duplicate cost ─────────────────────────────────────

describe("§24.3 idempotency — cost not doubled on duplicate", () => {
  it("submitting same eventId twice does not double materialized cost", () => {
    const db = setupDb();
    createPricing(db, {
      provider: "openai",
      model: "gpt-4",
      inputPricePerMillion: "30",
      cachedInputPricePerMillion: "15",
      outputPricePerMillion: "60",
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: null,
    });
    const event = baseEvent({ usage: { inputTokens: 1000000, outputTokens: 0, totalTokens: 1000000 } });
    ingestEvent(db, event as any, "test-app");
    ingestEvent(db, event as any, "test-app"); // duplicate

    const rows = db.prepare("SELECT * FROM events WHERE event_id = ?").all(event.eventId) as Array<unknown>;
    expect(rows).toHaveLength(1);

    const row = rows[0] as Record<string, unknown>;
    // Cost should be exactly 30 (1M tokens * $30/M), not 60
    expect(row["total_cost"]).toBe("30.0000000000");
  });
});

// §24.2 authentication is covered by tests/events/http.test.ts and tests/auth/auth.test.ts
