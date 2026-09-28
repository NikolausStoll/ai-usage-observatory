import { createTestDb } from "../../src/db/database.js";
import { createApplication } from "../../src/domain/applications/application-service.js";
import type Database from "better-sqlite3";
import type { CreatePricing } from "../../src/domain/pricing/pricing-schema.js";
import type { ArtifactStorage } from "../../src/domain/artifacts/artifact-storage.js";

export function setupTestDb(): Database.Database {
  return createTestDb();
}

export function createTestApp(db: Database.Database, id = "test-app") {
  return createApplication(db, id, "Test App");
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

// Minimal valid image buffers

/** 1x1 PNG */
export function makePngBuffer(): Buffer {
  // PNG signature + IHDR chunk (width=1, height=1)
  const buf = Buffer.alloc(33);
  buf.writeUInt32BE(0x89504e47, 0); // magic
  buf.writeUInt32BE(0x0d0a1a0a, 4); // continuation
  // IHDR chunk: length=13
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "ascii");
  buf.writeUInt32BE(1, 16); // width = 1
  buf.writeUInt32BE(1, 20); // height = 1
  buf[24] = 8; // bit depth
  buf[25] = 2; // color type RGB
  return buf;
}

/** Minimal 1x1 JPEG */
export function makeJpegBuffer(): Buffer {
  // SOI + SOF0 marker
  const buf = Buffer.alloc(20);
  buf[0] = 0xff; buf[1] = 0xd8; // SOI
  buf[2] = 0xff; buf[3] = 0xc0; // SOF0
  buf.writeUInt16BE(17, 4); // segment length
  buf[6] = 8; // precision
  buf.writeUInt16BE(2, 7); // height
  buf.writeUInt16BE(3, 9); // width
  return buf;
}

/** Minimal 4x5 GIF */
export function makeGifBuffer(): Buffer {
  const buf = Buffer.alloc(13);
  buf.write("GIF89a", 0, "ascii");
  buf.writeUInt16LE(4, 6); // width
  buf.writeUInt16LE(5, 8); // height
  return buf;
}
