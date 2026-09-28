import { createTestDb } from "../../src/db/database.js";
import { createApplication, createApiKey } from "../../src/domain/applications/application-service.js";
import { generateApiKey, hashApiKey } from "../../src/domain/auth/auth.js";
import type Database from "better-sqlite3";

export function setupTestDb(): Database.Database {
  return createTestDb();
}

export function createTestApp(db: Database.Database, id = "test-app", name = "Test App") {
  return createApplication(db, id, name);
}

export function createTestApiKey(db: Database.Database, appId: string, keyName = "test-key") {
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const apiKey = createApiKey(db, appId, keyName, keyHash);
  return { apiKey, rawKey };
}

export const validEvent = {
  eventId: "0199c9f2-9f16-7abc-8def-123456789abc",
  timestamp: "2026-09-09T12:34:56.123Z",
  durationMs: 1843,
  environment: "production",
  feature: "recipe-import",
  operation: "image-extraction",
  operationId: "recipe-import:123:image-extraction",
  workflowId: "recipe-import:123",
  attemptNumber: 1,
  status: "success" as const,
  provider: "openai",
  requestedModel: "example-model",
  reportedModel: "example-model-2026-09-01",
  promptId: "recipe-image-extraction",
  promptVersion: "14",
  requestConfig: { reasoningEffort: "medium" },
  request: {
    input: { instruction: "Extract the recipe from the supplied image." },
    raw: { example: "provider request representation" },
    metadata: { imageCount: 1 },
  },
  response: {
    output: { title: "Example Recipe" },
    raw: { example: "provider response representation" },
    metadata: {},
  },
  usage: {
    inputTokens: 1200,
    cachedInputTokens: 800,
    outputTokens: 300,
    reasoningTokens: 120,
    totalTokens: 1500,
    rawUsage: { example: "provider-native usage representation" },
  },
  metadata: { importSource: "photo" },
  metrics: { confidence: 0.94, ingredientCount: 12 },
};

export const validErrorEvent = {
  eventId: "0199c9f2-9f16-7abc-8def-123456789abd",
  timestamp: "2026-09-09T12:35:10.000Z",
  durationMs: 2110,
  environment: "production",
  feature: "recipe-import",
  operation: "image-extraction",
  operationId: "recipe-import:124:image-extraction",
  workflowId: "recipe-import:124",
  attemptNumber: 1,
  status: "error" as const,
  provider: "openai",
  requestedModel: "example-model",
  httpStatus: 200,
  error: {
    type: "schema_validation",
    message: "AI response could not be used by the application",
    metadata: { validationErrors: 2 },
  },
  response: {
    output: { unexpected: "shape" },
  },
  usage: {
    inputTokens: 900,
    cachedInputTokens: null,
    outputTokens: 210,
    reasoningTokens: null,
    totalTokens: 1110,
    rawUsage: {},
  },
};
