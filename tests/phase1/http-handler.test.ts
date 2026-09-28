import { describe, it, expect, beforeEach, vi } from "vitest";
import { setupTestDb, createTestApp, createTestApiKey, validEvent, validErrorEvent } from "./helpers.js";
import type Database from "better-sqlite3";

let db: Database.Database;
let rawKey: string;

vi.mock("../../src/db/database.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/db/database.js")>();
  return {
    ...actual,
    getDb: () => db,
  };
});

const { handleIngestEvent } = await import("../../src/api/routes/events.js");

beforeEach(() => {
  db = setupTestDb();
  createTestApp(db);
  const testKey = createTestApiKey(db, "test-app");
  rawKey = testKey.rawKey;
});

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${rawKey}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/events", () => {
  it("returns 200 with received:true for valid event", async () => {
    const res = await handleIngestEvent(makeRequest(validEvent));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
    expect(body.duplicate).toBe(false);
    expect(body.eventId).toBe(validEvent.eventId);
  });

  it("returns 401 for missing auth", async () => {
    const req = new Request("http://localhost/api/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validEvent),
    });
    const res = await handleIngestEvent(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("unauthorized");
  });

  it("returns 401 for invalid API key", async () => {
    const req = makeRequest(validEvent, { Authorization: "Bearer obs_badkey" });
    const res = await handleIngestEvent(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid event payload", async () => {
    const invalid = { ...validEvent, eventId: "not-a-uuid" };
    const res = await handleIngestEvent(makeRequest(invalid));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("validation_error");
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/v1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${rawKey}` },
      body: "not json {{",
    });
    const res = await handleIngestEvent(req);
    expect(res.status).toBe(400);
  });

  it("returns 200 with duplicate:true for repeated eventId", async () => {
    await handleIngestEvent(makeRequest(validEvent));
    const res = await handleIngestEvent(makeRequest(validEvent));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.duplicate).toBe(true);
    expect(body.received).toBe(false);
  });

  it("returns 413 for oversized payload (via content-length)", async () => {
    const req = new Request("http://localhost/api/v1/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rawKey}`,
        "Content-Length": String(2 * 1024 * 1024),
      },
      body: JSON.stringify(validEvent),
    });
    const res = await handleIngestEvent(req);
    expect(res.status).toBe(413);
  });

  it("accepts error events with usage", async () => {
    const res = await handleIngestEvent(makeRequest(validErrorEvent));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.received).toBe(true);
  });
});
