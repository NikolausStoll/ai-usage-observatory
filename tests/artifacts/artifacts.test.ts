import { describe, it, expect, beforeEach } from "vitest";
import { createHash } from "crypto";
import type Database from "better-sqlite3";
import {
  setupTestDb,
  createTestApp,
  makeEvent,
  MemoryArtifactStorage,
  makePngBuffer,
  makeJpegBuffer,
  makeGifBuffer,
} from "../helpers.js";
import { ingestEvent } from "../../src/domain/events/event-service.js";
import {
  uploadArtifact,
  getArtifact,
  listArtifactsForEvent,
} from "../../src/domain/artifacts/artifact-service.js";

let db: Database.Database;
let storage: MemoryArtifactStorage;

beforeEach(() => {
  db = setupTestDb();
  createTestApp(db);
  storage = new MemoryArtifactStorage();
});

function ingestTestEvent(overrides?: Record<string, unknown>) {
  const event = makeEvent(overrides);
  ingestEvent(db, event as any, "test-app");
  return event.eventId;
}

describe("artifact upload", () => {
  it("uploads artifact and returns metadata", async () => {
    const eventId = ingestTestEvent();
    const data = Buffer.from("hello world");

    const result = await uploadArtifact(db, storage, {
      eventId,
      role: "input",
      mimeType: "text/plain",
      data,
    });

    expect(result.artifactId).toBeTruthy();
    expect(result.byteSize).toBe(11);
    expect(result.contentHash).toBe(
      createHash("sha256").update(data).digest("hex")
    );
  });

  it("stores artifact in DB with correct metadata", async () => {
    const eventId = ingestTestEvent();
    const data = Buffer.from("test data");

    const result = await uploadArtifact(db, storage, {
      eventId,
      role: "output",
      label: "result-file",
      mimeType: "application/json",
      originalFilename: "result.json",
      data,
    });

    const record = getArtifact(db, result.artifactId);
    expect(record).not.toBeNull();
    expect(record!.eventId).toBe(eventId);
    expect(record!.role).toBe("output");
    expect(record!.label).toBe("result-file");
    expect(record!.mimeType).toBe("application/json");
    expect(record!.originalFilename).toBe("result.json");
    expect(record!.byteSize).toBe(9);
    expect(record!.contentHash).toBe(createHash("sha256").update(data).digest("hex"));
  });

  it("content hash matches SHA-256 of uploaded file", async () => {
    const eventId = ingestTestEvent();
    const data = Buffer.from("some binary content");
    const expectedHash = createHash("sha256").update(data).digest("hex");

    const result = await uploadArtifact(db, storage, {
      eventId,
      role: "input",
      mimeType: "application/octet-stream",
      data,
    });

    expect(result.contentHash).toBe(expectedHash);
    const record = getArtifact(db, result.artifactId);
    expect(record!.contentHash).toBe(expectedHash);
  });

  it("byte size matches uploaded data", async () => {
    const eventId = ingestTestEvent();
    const data = Buffer.alloc(256, 0xab);

    const result = await uploadArtifact(db, storage, {
      eventId,
      role: "input",
      mimeType: "application/octet-stream",
      data,
    });

    expect(result.byteSize).toBe(256);
    expect(getArtifact(db, result.artifactId)!.byteSize).toBe(256);
  });

  it("supports input and output roles", async () => {
    const eventId = ingestTestEvent();
    const data = Buffer.from("data");

    const inputResult = await uploadArtifact(db, storage, {
      eventId, role: "input", mimeType: "text/plain", data,
    });
    const outputResult = await uploadArtifact(db, storage, {
      eventId, role: "output", mimeType: "text/plain", data,
    });

    expect(getArtifact(db, inputResult.artifactId)!.role).toBe("input");
    expect(getArtifact(db, outputResult.artifactId)!.role).toBe("output");
  });

  it("optional label is stored correctly", async () => {
    const eventId = ingestTestEvent();
    const data = Buffer.from("data");

    const withLabel = await uploadArtifact(db, storage, {
      eventId, role: "input", mimeType: "text/plain", label: "my-label", data,
    });
    const withoutLabel = await uploadArtifact(db, storage, {
      eventId, role: "input", mimeType: "text/plain", data,
    });

    expect(getArtifact(db, withLabel.artifactId)!.label).toBe("my-label");
    expect(getArtifact(db, withoutLabel.artifactId)!.label).toBeNull();
  });

  it("artifact binary is stored outside SQLite (in storage layer)", async () => {
    const eventId = ingestTestEvent();
    const data = Buffer.from("binary data here");

    const result = await uploadArtifact(db, storage, {
      eventId, role: "input", mimeType: "application/octet-stream", data,
    });

    // Verify binary is in storage
    const retrieved = await storage.retrieve(result.artifactId);
    expect(retrieved).toEqual(data);

    // Verify DB row does NOT contain binary data
    const dbRow = db.prepare("SELECT * FROM artifacts WHERE artifact_id = ?")
      .get(result.artifactId) as Record<string, unknown>;
    for (const [key, val] of Object.entries(dbRow)) {
      if (typeof val === "string" && key !== "storage_key" && key !== "content_hash") {
        expect(val.length).toBeLessThan(1000); // no binary blobs in DB row
      }
    }
  });

  it("lists artifacts for an event", async () => {
    const eventId = ingestTestEvent();
    const data = Buffer.from("data");

    await uploadArtifact(db, storage, { eventId, role: "input", mimeType: "text/plain", data });
    await uploadArtifact(db, storage, { eventId, role: "output", mimeType: "text/plain", data });

    const artifacts = listArtifactsForEvent(db, eventId);
    expect(artifacts).toHaveLength(2);
  });
});

describe("image dimensions", () => {
  it("detects PNG dimensions", async () => {
    const eventId = ingestTestEvent();
    const result = await uploadArtifact(db, storage, {
      eventId, role: "input", mimeType: "image/png", data: makePngBuffer(),
    });
    const record = getArtifact(db, result.artifactId);
    expect(record!.width).toBe(1);
    expect(record!.height).toBe(1);
  });

  it("detects JPEG dimensions", async () => {
    const eventId = ingestTestEvent();
    const result = await uploadArtifact(db, storage, {
      eventId, role: "input", mimeType: "image/jpeg", data: makeJpegBuffer(),
    });
    const record = getArtifact(db, result.artifactId);
    expect(record!.width).toBe(3);
    expect(record!.height).toBe(2);
  });

  it("detects GIF dimensions", async () => {
    const eventId = ingestTestEvent();
    const result = await uploadArtifact(db, storage, {
      eventId, role: "input", mimeType: "image/gif", data: makeGifBuffer(),
    });
    const record = getArtifact(db, result.artifactId);
    expect(record!.width).toBe(4);
    expect(record!.height).toBe(5);
  });

  it("non-image artifacts have null dimensions", async () => {
    const eventId = ingestTestEvent();
    const result = await uploadArtifact(db, storage, {
      eventId, role: "input", mimeType: "text/plain", data: Buffer.from("text"),
    });
    const record = getArtifact(db, result.artifactId);
    expect(record!.width).toBeNull();
    expect(record!.height).toBeNull();
  });
});

describe("artifact retrieval", () => {
  it("retrieves artifact binary from storage", async () => {
    const eventId = ingestTestEvent();
    const data = Buffer.from("retrievable content");

    const result = await uploadArtifact(db, storage, {
      eventId, role: "input", mimeType: "text/plain", data,
    });

    const record = getArtifact(db, result.artifactId);
    const retrieved = await storage.retrieve(record!.storageKey);
    expect(retrieved).toEqual(data);
  });
});
