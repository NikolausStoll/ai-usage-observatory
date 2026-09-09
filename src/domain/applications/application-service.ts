import type Database from "better-sqlite3";
import { randomUUID } from "crypto";

export interface Application {
  id: string;
  displayName: string;
  createdAt: string;
}

export function createApplication(
  db: Database.Database,
  id: string,
  displayName: string
): Application {
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO applications (id, display_name, created_at) VALUES (?, ?, ?)"
  ).run(id, displayName, createdAt);
  return { id, displayName, createdAt };
}

export function getApplication(
  db: Database.Database,
  id: string
): Application | null {
  const row = db
    .prepare("SELECT id, display_name, created_at FROM applications WHERE id = ?")
    .get(id) as { id: string; display_name: string; created_at: string } | undefined;
  if (!row) return null;
  return { id: row.id, displayName: row.display_name, createdAt: row.created_at };
}

export function listApplications(db: Database.Database): Application[] {
  const rows = db
    .prepare("SELECT id, display_name, created_at FROM applications ORDER BY created_at")
    .all() as Array<{ id: string; display_name: string; created_at: string }>;
  return rows.map((r) => ({ id: r.id, displayName: r.display_name, createdAt: r.created_at }));
}

export interface ApiKey {
  id: string;
  applicationId: string;
  name: string;
  keyHash: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export function createApiKey(
  db: Database.Database,
  applicationId: string,
  name: string,
  keyHash: string
): ApiKey {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO api_keys (id, application_id, name, key_hash, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, applicationId, name, keyHash, createdAt);
  return { id, applicationId, name, keyHash, createdAt, lastUsedAt: null, revokedAt: null };
}

export function findApiKeyByHash(
  db: Database.Database,
  keyHash: string
): ApiKey | null {
  const row = db
    .prepare("SELECT * FROM api_keys WHERE key_hash = ?")
    .get(keyHash) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row["id"] as string,
    applicationId: row["application_id"] as string,
    name: row["name"] as string,
    keyHash: row["key_hash"] as string,
    createdAt: row["created_at"] as string,
    lastUsedAt: row["last_used_at"] as string | null,
    revokedAt: row["revoked_at"] as string | null,
  };
}

export function updateKeyLastUsed(db: Database.Database, keyId: string): void {
  db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    keyId
  );
}

export function revokeApiKey(db: Database.Database, keyId: string): void {
  db.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    keyId
  );
}

export function listApiKeys(
  db: Database.Database,
  applicationId: string
): ApiKey[] {
  const rows = db
    .prepare("SELECT * FROM api_keys WHERE application_id = ? ORDER BY created_at")
    .all(applicationId) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: r["id"] as string,
    applicationId: r["application_id"] as string,
    name: r["name"] as string,
    keyHash: r["key_hash"] as string,
    createdAt: r["created_at"] as string,
    lastUsedAt: r["last_used_at"] as string | null,
    revokedAt: r["revoked_at"] as string | null,
  }));
}
