import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db/database.js";
import {
  listApplications,
  createApplication,
  updateApplicationDisplayName,
  listApiKeys,
  createApiKeyWithGeneration,
  revokeApiKey,
} from "../domain/applications/application-service.js";

export const fetchApplications = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb();
    return listApplications(db);
  });

export const fetchApiKeys = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.string().parse(input))
  .handler(async ({ data: applicationId }) => {
    const db = getDb();
    return listApiKeys(db, applicationId);
  });

export const createApplicationFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string().min(1), displayName: z.string().min(1) }).parse(input)
  )
  .handler(async ({ data }) => {
    const db = getDb();
    return createApplication(db, data.id, data.displayName);
  });

export const updateApplicationDisplayNameFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string(), displayName: z.string().min(1) }).parse(input)
  )
  .handler(async ({ data }) => {
    const db = getDb();
    updateApplicationDisplayName(db, data.id, data.displayName);
    return { ok: true };
  });

export const createApiKeyFn = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ applicationId: z.string(), name: z.string().min(1) }).parse(input)
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const { key, plaintext } = createApiKeyWithGeneration(db, data.applicationId, data.name);
    return { key, plaintext };
  });

export const revokeApiKeyFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.string().parse(input))
  .handler(async ({ data: keyId }) => {
    const db = getDb();
    revokeApiKey(db, keyId);
    return { ok: true };
  });
