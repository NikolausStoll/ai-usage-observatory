import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../../src/db/database.js";
import { createApplication } from "../../src/domain/applications/application-service.js";
import {
  ingestEvent,
  listEvents,
  getEvent,
} from "../../src/domain/events/event-service.js";
import {
  listSubjectGroups,
  resolveSubjectDisplayLabel,
} from "../../src/domain/events/subject.js";
import type { IngestEvent } from "../../src/domain/events/event-schema.js";

let db: Database.Database;

function makeEvent(
  overrides: Partial<IngestEvent> & Pick<IngestEvent, "eventId">
): IngestEvent {
  return {
    timestamp: "2026-09-09T12:00:00.000Z",
    durationMs: 100,
    environment: "test",
    feature: "feat",
    operation: "op",
    operationId: "op-1",
    attemptNumber: 1,
    status: "success",
    provider: "openai",
    requestedModel: "gpt-4",
    ...overrides,
  };
}

beforeEach(() => {
  db = createTestDb();
  createApplication(db, "app-1", "Recipe App");
  createApplication(db, "app-2", "Media Library");
});

describe("subject grouping semantics", () => {
  it("groups by applicationId + subjectId regardless of differing labels", () => {
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000001",
        timestamp: "2026-09-09T10:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000002",
        timestamp: "2026-09-09T11:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf mit Paprika",
      }),
      "app-1"
    );

    const groups = listSubjectGroups(db);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.applicationId).toBe("app-1");
    expect(groups[0]!.subjectId).toBe("recipe:123");
    expect(groups[0]!.eventCount).toBe(2);
  });

  it("uses the latest non-empty label by event timestamp for grouped display", () => {
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000001",
        timestamp: "2026-09-09T10:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000002",
        timestamp: "2026-09-09T11:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf mit Paprika",
      }),
      "app-1"
    );

    expect(resolveSubjectDisplayLabel(db, "app-1", "recipe:123")).toBe(
      "Kartoffelauflauf mit Paprika"
    );
    expect(listSubjectGroups(db)[0]!.displayLabel).toBe(
      "Kartoffelauflauf mit Paprika"
    );
  });

  it("does not erase the previous useful label when a newer event has null subjectLabel", () => {
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000001",
        timestamp: "2026-09-09T10:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000002",
        timestamp: "2026-09-09T11:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf mit Paprika",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000003",
        timestamp: "2026-09-09T12:00:00.000Z",
        subjectId: "recipe:123",
        // no subjectLabel
      }),
      "app-1"
    );

    expect(resolveSubjectDisplayLabel(db, "app-1", "recipe:123")).toBe(
      "Kartoffelauflauf mit Paprika"
    );
  });

  it("uses event timestamp, not ingestion order, for latest label", () => {
    // Ingest newer-timestamped event first, then older — out-of-order ingestion.
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000002",
        timestamp: "2026-09-09T11:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf mit Paprika",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000001",
        timestamp: "2026-09-09T10:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf",
      }),
      "app-1"
    );

    expect(resolveSubjectDisplayLabel(db, "app-1", "recipe:123")).toBe(
      "Kartoffelauflauf mit Paprika"
    );
  });

  it("keeps the same subjectId separate across applications", () => {
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000001",
        timestamp: "2026-09-09T10:00:00.000Z",
        subjectId: "item:1",
        subjectLabel: "Recipe Item",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000002",
        timestamp: "2026-09-09T11:00:00.000Z",
        subjectId: "item:1",
        subjectLabel: "Book Item",
      }),
      "app-2"
    );

    const groups = listSubjectGroups(db);
    expect(groups).toHaveLength(2);
    expect(resolveSubjectDisplayLabel(db, "app-1", "item:1")).toBe("Recipe Item");
    expect(resolveSubjectDisplayLabel(db, "app-2", "item:1")).toBe("Book Item");
  });

  it("preserves each event's historical subjectLabel on detail", () => {
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000001",
        timestamp: "2026-09-09T10:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000002",
        timestamp: "2026-09-09T11:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf mit Paprika",
      }),
      "app-1"
    );

    const older = getEvent(db, "00000000-0000-4000-8000-000000000001")!;
    expect(older["subject_label"]).toBe("Kartoffelauflauf");
    expect(older["subject_id"]).toBe("recipe:123");

    const newer = getEvent(db, "00000000-0000-4000-8000-000000000002")!;
    expect(newer["subject_label"]).toBe("Kartoffelauflauf mit Paprika");

    // Group display uses latest; historical rows untouched.
    expect(resolveSubjectDisplayLabel(db, "app-1", "recipe:123")).toBe(
      "Kartoffelauflauf mit Paprika"
    );
  });

  it("filters events by subject group (applicationId + subjectId)", () => {
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000001",
        subjectId: "recipe:123",
        subjectLabel: "A",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000002",
        subjectId: "recipe:123",
        subjectLabel: "B",
      }),
      "app-2"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000003",
        subjectId: "recipe:999",
        subjectLabel: "Other",
      }),
      "app-1"
    );

    const r = listEvents(db, {
      subjectApplicationId: "app-1",
      subjectId: "recipe:123",
    });
    expect(r.items).toHaveLength(1);
    expect(r.items[0]!.eventId).toBe("00000000-0000-4000-8000-000000000001");
  });

  it("subjectLabel search is group-aware (finds sibling events including null labels)", () => {
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000001",
        timestamp: "2026-09-09T10:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000002",
        timestamp: "2026-09-09T11:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf mit Paprika",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000003",
        timestamp: "2026-09-09T12:00:00.000Z",
        subjectId: "recipe:123",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000004",
        subjectId: "book:1",
        subjectLabel: "Unrelated",
      }),
      "app-1"
    );

    const byCurrent = listEvents(db, { subjectLabel: "paprika" });
    expect(byCurrent.items.map((i) => i.eventId).sort()).toEqual([
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
    ]);

    // List items still expose each event's historical label.
    const older = byCurrent.items.find(
      (i) => i.eventId === "00000000-0000-4000-8000-000000000001"
    )!;
    expect(older.subjectLabel).toBe("Kartoffelauflauf");
    const nullLabel = byCurrent.items.find(
      (i) => i.eventId === "00000000-0000-4000-8000-000000000003"
    )!;
    expect(nullLabel.subjectLabel).toBeNull();
  });

  it("exposes subject groups with display labels on facets", () => {
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000001",
        timestamp: "2026-09-09T10:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf",
      }),
      "app-1"
    );
    ingestEvent(
      db,
      makeEvent({
        eventId: "00000000-0000-4000-8000-000000000002",
        timestamp: "2026-09-09T11:00:00.000Z",
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf mit Paprika",
      }),
      "app-1"
    );

    const { facets } = listEvents(db);
    expect(facets.subjects).toHaveLength(1);
    expect(facets.subjects[0]!.displayLabel).toBe("Kartoffelauflauf mit Paprika");
    expect(facets.subjects[0]!.labels).toEqual(
      expect.arrayContaining(["Kartoffelauflauf", "Kartoffelauflauf mit Paprika"])
    );
  });
});
