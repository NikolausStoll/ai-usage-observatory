import { describe, it, expect, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { initDb } from "../../src/db/database.js";
import { createApplication } from "../../src/domain/applications/application-service.js";
import { ingestEvent } from "../../src/domain/events/event-service.js";
import { FileSystemArtifactStorage } from "../../src/domain/artifacts/artifact-storage.js";

const TMP_DIR = join(tmpdir(), "obs-persistence-test-" + process.pid);

afterEach(() => {
  if (existsSync(TMP_DIR)) rmSync(TMP_DIR, { recursive: true });
});

describe("data persists across DB reconnect", () => {
  it("event written to file DB survives close+reopen", () => {
    mkdirSync(TMP_DIR, { recursive: true });
    const dbPath = join(TMP_DIR, "observatory.sqlite");

    // Write
    const db1 = initDb(dbPath);
    createApplication(db1, "app-1", "Test App");
    ingestEvent(db1, {
      eventId: "00000000-0000-4000-8000-aaaaaaaaaaaa",
      timestamp: "2026-09-09T12:00:00.000Z",
      durationMs: 100,
      environment: "test",
      feature: "f",
      operation: "op",
      operationId: "op-id",
      attemptNumber: 1,
      status: "success",
      provider: "openai",
      requestedModel: "gpt-4",
    }, "app-1");
    db1.close();

    // Reopen
    const db2 = new Database(dbPath);
    const row = db2.prepare("SELECT event_id FROM events").get() as { event_id: string } | undefined;
    expect(row).toBeDefined();
    expect(row!.event_id).toBe("00000000-0000-4000-8000-aaaaaaaaaaaa");
    db2.close();
  });
});

describe("artifact persistence", () => {
  it("artifact binary persists on filesystem", async () => {
    const artifactsDir = join(TMP_DIR, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    const storage = new FileSystemArtifactStorage(artifactsDir);
    const content = Buffer.from("hello artifact world");
    const key = "test-artifact-key";

    await storage.store(key, content);
    const retrieved = await storage.retrieve(key);
    expect(retrieved.equals(content)).toBe(true);
  });

  it("artifact binary is stored outside SQLite (as a file)", async () => {
    const artifactsDir = join(TMP_DIR, "artifacts");
    mkdirSync(artifactsDir, { recursive: true });

    const storage = new FileSystemArtifactStorage(artifactsDir);
    const content = Buffer.from("binary data outside db");
    const key = "outside-db-key";

    await storage.store(key, content);
    expect(existsSync(join(artifactsDir, key))).toBe(true);
  });
});
