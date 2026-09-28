import { createTestDb } from "../src/db/database.js";
import { createApplication, createApiKey } from "../src/domain/applications/application-service.js";
import { generateApiKey, hashApiKey } from "../src/domain/auth/auth.js";
import type Database from "better-sqlite3";
import type { CreatePricing } from "../src/domain/pricing/pricing-schema.js";
import type { ArtifactStorage } from "../src/domain/artifacts/artifact-storage.js";

export function setupTestDb(): Database.Database {
  return createTestDb();
}

export function createTestApp(
  db: Database.Database,
  id = "test-app",
  name = "Test App"
) {
  return createApplication(db, id, name);
}

export function createTestApiKey(
  db: Database.Database,
  appId: string,
  keyName = "test-key"
) {
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const apiKey = createApiKey(db, appId, keyName, keyHash);
  return { apiKey, rawKey };
}

export const stdPricing: CreatePricing = {
  provider: "openai",
  model: "gpt-4",
  inputPricePerMillion: "30",
  cachedInputPricePerMillion: "15",
  outputPricePerMillion: "60",
  validFrom: "2026-01-01T00:00:00.000Z",
  validUntil: null,
};

export function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    eventId: crypto.randomUUID(),
    timestamp: "2026-09-09T12:00:00.000Z",
    durationMs: 1000,
    environment: "production",
    feature: "test-feature",
    operation: "test-op",
    operationId: "op-1",
    attemptNumber: 1,
    status: "success" as const,
    provider: "openai",
    requestedModel: "gpt-4",
    ...overrides,
  };
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

/** In-memory artifact storage for tests */
export class MemoryArtifactStorage implements ArtifactStorage {
  private _data: Map<string, Buffer> = new Map();

  async store(key: string, data: Buffer): Promise<void> {
    this._data.set(key, Buffer.from(data));
  }

  async retrieve(key: string): Promise<Buffer> {
    const data = this._data.get(key);
    if (!data) throw new Error(`Not found: ${key}`);
    return data;
  }

  async delete(key: string): Promise<void> {
    this._data.delete(key);
  }
}

/** 1x1 PNG */
export function makePngBuffer(): Buffer {
  const buf = Buffer.alloc(33);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt32BE(0x0d0a1a0a, 4);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(1, 16);
  buf.writeUInt32BE(1, 20);
  buf[24] = 8;
  buf[25] = 2;
  return buf;
}

/** Minimal 1x1 JPEG */
export function makeJpegBuffer(): Buffer {
  const buf = Buffer.alloc(20);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf[3] = 0xc0;
  buf.writeUInt16BE(17, 4);
  buf[6] = 8;
  buf.writeUInt16BE(2, 7);
  buf.writeUInt16BE(3, 9);
  return buf;
}

/** Minimal 4x5 GIF */
export function makeGifBuffer(): Buffer {
  const buf = Buffer.alloc(13);
  buf.write("GIF89a", 0, "ascii");
  buf.writeUInt16LE(4, 6);
  buf.writeUInt16LE(5, 8);
  return buf;
}
