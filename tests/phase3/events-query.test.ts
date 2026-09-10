import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../../src/db/database.js";
import { createApplication } from "../../src/domain/applications/application-service.js";
import { ingestEvent, listEvents, getEvent } from "../../src/domain/events/event-service.js";

let db: Database.Database;

function makeEvent(overrides: Partial<typeof base> & { eventId: string }) {
  return { ...base, ...overrides };
}

const base = {
  eventId: "00000000-0000-4000-8000-000000000001",
  timestamp: "2026-09-09T12:00:00.000Z",
  durationMs: 1000,
  environment: "production",
  feature: "feat-a",
  operation: "op-1",
  operationId: "op-id-1",
  attemptNumber: 1,
  status: "success" as const,
  provider: "openai",
  requestedModel: "gpt-4",
};

beforeEach(() => {
  db = createTestDb();
  createApplication(db, "app-1", "App One");
  createApplication(db, "app-2", "App Two");
});

describe("listEvents", () => {
  it("returns empty list when no events", () => {
    const result = listEvents(db);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("lists events with application name", () => {
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000001" }), "app-1");
    const result = listEvents(db);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.applicationName).toBe("App One");
    expect(result.items[0]!.eventId).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("filters by applicationId", () => {
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000001" }), "app-1");
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000002" }), "app-2");

    const r1 = listEvents(db, { applicationId: "app-1" });
    expect(r1.items).toHaveLength(1);
    expect(r1.items[0]!.applicationId).toBe("app-1");

    const r2 = listEvents(db, { applicationId: "app-2" });
    expect(r2.items).toHaveLength(1);
    expect(r2.items[0]!.applicationId).toBe("app-2");
  });

  it("filters by status", () => {
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000001", status: "success" }), "app-1");
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000002", status: "error" }), "app-1");

    const r = listEvents(db, { status: "error" });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.status).toBe("error");
  });

  it("filters by environment", () => {
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000001", environment: "production" }), "app-1");
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000002", environment: "staging" }), "app-1");

    const r = listEvents(db, { environment: "staging" });
    expect(r.items).toHaveLength(1);
  });

  it("filters by feature", () => {
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000001", feature: "feat-a" }), "app-1");
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000002", feature: "feat-b" }), "app-1");

    const r = listEvents(db, { feature: "feat-b" });
    expect(r.items).toHaveLength(1);
  });

  it("filters by provider", () => {
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000001", provider: "openai" }), "app-1");
    ingestEvent(db, makeEvent({ eventId: "00000000-0000-4000-8000-000000000002", provider: "anthropic" }), "app-1");

    const r = listEvents(db, { provider: "anthropic" });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.provider).toBe("anthropic");
  });

  it("paginates correctly", () => {
    for (let i = 1; i <= 5; i++) {
      ingestEvent(
        db,
        makeEvent({
          eventId: `00000000-0000-4000-8000-00000000000${i}`,
          timestamp: `2026-09-09T12:0${i}:00.000Z`,
        }),
        "app-1"
      );
    }
    const p1 = listEvents(db, {}, 1, 2);
    expect(p1.items).toHaveLength(2);
    expect(p1.total).toBe(5);
    expect(p1.page).toBe(1);
    expect(p1.pageSize).toBe(2);

    const p2 = listEvents(db, {}, 2, 2);
    expect(p2.items).toHaveLength(2);

    const p3 = listEvents(db, {}, 3, 2);
    expect(p3.items).toHaveLength(1);
  });

  it("returns cost fields when priced", () => {
    db.prepare(`
      INSERT INTO pricing (id, provider, model, input_price_per_million, cached_input_price_per_million,
        output_price_per_million, valid_from, valid_until, created_at, updated_at)
      VALUES ('p1', 'openai', 'gpt-4', '3.0', '1.5', '6.0', '2026-01-01T00:00:00.000Z', NULL,
        '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `).run();

    ingestEvent(
      db,
      { ...base, eventId: "00000000-0000-4000-8000-000000000001", usage: { inputTokens: 1000, outputTokens: 500, cachedInputTokens: null, reasoningTokens: null, totalTokens: 1500, rawUsage: null } },
      "app-1"
    );

    const r = listEvents(db);
    expect(r.items[0]!.totalCost).not.toBeNull();
    expect(r.items[0]!.pricingId).toBe("p1");
  });
});

describe("getEvent", () => {
  it("returns null for unknown event", () => {
    expect(getEvent(db, "nonexistent")).toBeNull();
  });

  it("returns full event detail with parsed JSON", () => {
    ingestEvent(db, {
      ...base,
      eventId: "00000000-0000-4000-8000-000000000001",
      metadata: { foo: "bar" },
      metrics: { confidence: 0.9 },
    }, "app-1");

    const ev = getEvent(db, "00000000-0000-4000-8000-000000000001");
    expect(ev).not.toBeNull();
    expect(ev!["metadata"]).toEqual({ foo: "bar" });
    expect(ev!["metrics"]).toEqual({ confidence: 0.9 });
  });
});
