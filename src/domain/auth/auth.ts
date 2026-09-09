import { createHash } from "crypto";
import { randomBytes } from "crypto";
import type Database from "better-sqlite3";
import {
  findApiKeyByHash,
  updateKeyLastUsed,
} from "../applications/application-service.js";

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKey(): string {
  return "obs_" + randomBytes(32).toString("hex");
}

export interface AuthResult {
  applicationId: string;
  keyId: string;
}

export function authenticateRequest(
  db: Database.Database,
  authHeader: string | undefined
): AuthResult | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return null;

  const keyHash = hashApiKey(rawKey);
  const apiKey = findApiKeyByHash(db, keyHash);

  if (!apiKey) return null;
  if (apiKey.revokedAt) return null;

  updateKeyLastUsed(db, apiKey.id);

  return { applicationId: apiKey.applicationId, keyId: apiKey.id };
}
