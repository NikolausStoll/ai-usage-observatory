import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb, createTestApp, createTestApiKey } from "./helpers.js";
import { authenticateRequest } from "../../src/domain/auth/auth.js";
import { revokeApiKey } from "../../src/domain/applications/application-service.js";
import type Database from "better-sqlite3";

let db: Database.Database;

beforeEach(() => {
  db = setupTestDb();
  createTestApp(db);
});

describe("API key authentication", () => {
  it("accepts a valid key", () => {
    const { rawKey } = createTestApiKey(db, "test-app");
    const result = authenticateRequest(db, `Bearer ${rawKey}`);
    expect(result).not.toBeNull();
    expect(result!.applicationId).toBe("test-app");
  });

  it("returns null for invalid key", () => {
    const result = authenticateRequest(db, "Bearer obs_invalid_key_that_does_not_exist");
    expect(result).toBeNull();
  });

  it("returns null for missing Authorization header", () => {
    const result = authenticateRequest(db, undefined);
    expect(result).toBeNull();
  });

  it("returns null for malformed Authorization header (no Bearer prefix)", () => {
    const { rawKey } = createTestApiKey(db, "test-app");
    const result = authenticateRequest(db, rawKey);
    expect(result).toBeNull();
  });

  it("returns null for revoked key", () => {
    const { rawKey, apiKey } = createTestApiKey(db, "test-app");
    revokeApiKey(db, apiKey.id);
    const result = authenticateRequest(db, `Bearer ${rawKey}`);
    expect(result).toBeNull();
  });

  it("application identity is from the key, not from client", () => {
    createTestApp(db, "other-app", "Other App");
    const { rawKey } = createTestApiKey(db, "test-app");
    const result = authenticateRequest(db, `Bearer ${rawKey}`);
    expect(result!.applicationId).toBe("test-app");
  });

  it("supports multiple keys for one application", () => {
    const { rawKey: key1 } = createTestApiKey(db, "test-app", "key-1");
    const { rawKey: key2 } = createTestApiKey(db, "test-app", "key-2");
    const r1 = authenticateRequest(db, `Bearer ${key1}`);
    const r2 = authenticateRequest(db, `Bearer ${key2}`);
    expect(r1!.applicationId).toBe("test-app");
    expect(r2!.applicationId).toBe("test-app");
    expect(r1!.keyId).not.toBe(r2!.keyId);
  });

  it("updates last_used_at on successful auth", () => {
    const { rawKey, apiKey } = createTestApiKey(db, "test-app");
    const before = db.prepare("SELECT last_used_at FROM api_keys WHERE id = ?").get(apiKey.id) as { last_used_at: string | null };
    expect(before.last_used_at).toBeNull();

    authenticateRequest(db, `Bearer ${rawKey}`);

    const after = db.prepare("SELECT last_used_at FROM api_keys WHERE id = ?").get(apiKey.id) as { last_used_at: string | null };
    expect(after.last_used_at).not.toBeNull();
  });
});
