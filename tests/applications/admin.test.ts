import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../../src/db/database.js";
import {
  createApplication,
  listApplications,
  updateApplicationDisplayName,
  createApiKeyWithGeneration,
  listApiKeys,
  revokeApiKey,
} from "../../src/domain/applications/application-service.js";
import { authenticateRequest } from "../../src/domain/auth/auth.js";

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

describe("application CRUD", () => {
  it("creates and lists applications", () => {
    createApplication(db, "app-1", "App One");
    createApplication(db, "app-2", "App Two");
    const apps = listApplications(db);
    expect(apps).toHaveLength(2);
    expect(apps.map((a) => a.id)).toContain("app-1");
    expect(apps.map((a) => a.id)).toContain("app-2");
  });

  it("updateApplicationDisplayName changes the display name", () => {
    createApplication(db, "app-1", "Old Name");
    updateApplicationDisplayName(db, "app-1", "New Name");
    const apps = listApplications(db);
    expect(apps[0]!.displayName).toBe("New Name");
  });

  it("returns applications in created order", () => {
    createApplication(db, "z-app", "Z");
    createApplication(db, "a-app", "A");
    const apps = listApplications(db);
    expect(apps[0]!.id).toBe("z-app");
    expect(apps[1]!.id).toBe("a-app");
  });
});

describe("API key management", () => {
  beforeEach(() => {
    createApplication(db, "app-1", "Test App");
  });

  it("createApiKeyWithGeneration returns plaintext and stores hash", () => {
    const { key, plaintext } = createApiKeyWithGeneration(db, "app-1", "prod-key");
    expect(plaintext).toMatch(/^obs_[0-9a-f]{64}$/);
    expect(key.applicationId).toBe("app-1");
    expect(key.name).toBe("prod-key");
    expect(key.keyHash).not.toBe(plaintext);
    expect(key.revokedAt).toBeNull();
  });

  it("lists API keys for application", () => {
    createApiKeyWithGeneration(db, "app-1", "key-1");
    createApiKeyWithGeneration(db, "app-1", "key-2");
    const keys = listApiKeys(db, "app-1");
    expect(keys).toHaveLength(2);
    expect(keys.map((k) => k.name)).toContain("key-1");
    expect(keys.map((k) => k.name)).toContain("key-2");
  });

  it("revokes a key", () => {
    const { key } = createApiKeyWithGeneration(db, "app-1", "to-revoke");
    revokeApiKey(db, key.id);
    const keys = listApiKeys(db, "app-1");
    const revoked = keys.find((k) => k.id === key.id)!;
    expect(revoked.revokedAt).not.toBeNull();
  });

  it("revoked key is rejected by auth", () => {
    const { key, plaintext } = createApiKeyWithGeneration(db, "app-1", "key");
    revokeApiKey(db, key.id);
    const result = authenticateRequest(db, `Bearer ${plaintext}`);
    expect(result).toBeNull();
  });

  it("multiple applications have isolated key namespaces", () => {
    createApplication(db, "app-2", "App Two");
    createApiKeyWithGeneration(db, "app-1", "key-a");
    createApiKeyWithGeneration(db, "app-2", "key-b");
    expect(listApiKeys(db, "app-1")).toHaveLength(1);
    expect(listApiKeys(db, "app-2")).toHaveLength(1);
  });
});
