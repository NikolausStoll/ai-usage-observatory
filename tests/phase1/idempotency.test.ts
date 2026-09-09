import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb, createTestApp, validEvent } from "./helpers.js";
import { ingestEvent } from "../../src/domain/events/event-service.js";
import type Database from "better-sqlite3";

let db: Database.Database;

beforeEach(() => {
  db = setupTestDb();
  createTestApp(db);
});

describe("idempotency", () => {
  it("second submission of same eventId returns duplicate=true", () => {
    ingestEvent(db, validEvent, "test-app");
    const result = ingestEvent(db, validEvent, "test-app");
    expect(result.duplicate).toBe(true);
    expect(result.received).toBe(false);
  });

  it("duplicate does not create a second event row", () => {
    ingestEvent(db, validEvent, "test-app");
    ingestEvent(db, validEvent, "test-app");
    const count = db.prepare("SELECT COUNT(*) as cnt FROM events WHERE event_id = ?")
      .get(validEvent.eventId) as { cnt: number };
    expect(count.cnt).toBe(1);
  });

  it("duplicate with changed payload does not overwrite original telemetry", () => {
    ingestEvent(db, validEvent, "test-app");

    const modified = { ...validEvent, environment: "staging", feature: "different-feature" };
    ingestEvent(db, modified, "test-app");

    const row = db.prepare("SELECT environment, feature FROM events WHERE event_id = ?")
      .get(validEvent.eventId) as { environment: string; feature: string };
    expect(row.environment).toBe("production");
    expect(row.feature).toBe("recipe-import");
  });
});
