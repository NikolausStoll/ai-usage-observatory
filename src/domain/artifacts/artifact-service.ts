import { createHash, randomUUID } from "crypto";
import type Database from "better-sqlite3";
import type { ArtifactRole, ArtifactRecord } from "./artifact-schema.js";
import type { ArtifactStorage } from "./artifact-storage.js";

// ─── Image Dimensions ────────────────────────────────────────────────────────

interface Dimensions { width: number; height: number }

function getImageDimensions(buffer: Buffer, mimeType: string): Dimensions | null {
  try {
    if (mimeType === "image/png" || mimeType.includes("png")) {
      return getPngDimensions(buffer);
    }
    if (mimeType === "image/jpeg" || mimeType === "image/jpg" || mimeType.includes("jpeg")) {
      return getJpegDimensions(buffer);
    }
    if (mimeType === "image/webp" || mimeType.includes("webp")) {
      return getWebpDimensions(buffer);
    }
    if (mimeType === "image/gif" || mimeType.includes("gif")) {
      return getGifDimensions(buffer);
    }
  } catch {
    // ignore dimension parsing errors
  }
  return null;
}

function getPngDimensions(buf: Buffer): Dimensions | null {
  // PNG signature: 8 bytes, then IHDR chunk: 4 len, 4 type, 4 width, 4 height
  if (buf.length < 24) return null;
  if (buf.readUInt32BE(0) !== 0x89504e47) return null; // PNG magic
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

function getJpegDimensions(buf: Buffer): Dimensions | null {
  if (buf.length < 4) return null;
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null; // JPEG SOI
  let offset = 2;
  while (offset < buf.length - 8) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1]!;
    const segLen = buf.readUInt16BE(offset + 2);
    // SOF markers: 0xC0, 0xC1, 0xC2
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + segLen;
  }
  return null;
}

function getWebpDimensions(buf: Buffer): Dimensions | null {
  // RIFF....WEBP
  if (buf.length < 30) return null;
  if (buf.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const type = buf.toString("ascii", 12, 16);
  if (type === "VP8 ") {
    // Lossy: skip 10 bytes after VP8 chunk header
    if (buf.length < 30) return null;
    const width = (buf.readUInt16LE(26) & 0x3fff) + 1;
    const height = (buf.readUInt16LE(28) & 0x3fff) + 1;
    return { width, height };
  }
  if (type === "VP8L") {
    if (buf.length < 25) return null;
    const bits = buf.readUInt32LE(21);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >> 14) & 0x3fff) + 1;
    return { width, height };
  }
  if (type === "VP8X") {
    if (buf.length < 30) return null;
    const width = ((buf[24]! | (buf[25]! << 8) | (buf[26]! << 16)) & 0xffffff) + 1;
    const height = ((buf[27]! | (buf[28]! << 8) | (buf[29]! << 16)) & 0xffffff) + 1;
    return { width, height };
  }
  return null;
}

function getGifDimensions(buf: Buffer): Dimensions | null {
  if (buf.length < 10) return null;
  const sig = buf.toString("ascii", 0, 6);
  if (sig !== "GIF87a" && sig !== "GIF89a") return null;
  const width = buf.readUInt16LE(6);
  const height = buf.readUInt16LE(8);
  return { width, height };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export interface UploadArtifactInput {
  eventId: string;
  role: ArtifactRole;
  label?: string;
  mimeType: string;
  originalFilename?: string;
  data: Buffer;
}

export interface UploadResult {
  artifactId: string;
  byteSize: number;
  contentHash: string;
}

export async function uploadArtifact(
  db: Database.Database,
  storage: ArtifactStorage,
  input: UploadArtifactInput
): Promise<UploadResult> {
  const artifactId = randomUUID();
  const contentHash = createHash("sha256").update(input.data).digest("hex");
  const byteSize = input.data.length;
  const storageKey = artifactId;

  const dims = getImageDimensions(input.data, input.mimeType);

  await storage.store(storageKey, input.data);

  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO artifacts (
      artifact_id, event_id, role, label, mime_type, original_filename,
      byte_size, width, height, content_hash, storage_key, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    artifactId,
    input.eventId,
    input.role,
    input.label ?? null,
    input.mimeType,
    input.originalFilename ?? null,
    byteSize,
    dims?.width ?? null,
    dims?.height ?? null,
    contentHash,
    storageKey,
    createdAt
  );

  return { artifactId, byteSize, contentHash };
}

export function getArtifact(db: Database.Database, artifactId: string): ArtifactRecord | null {
  const row = db
    .prepare("SELECT * FROM artifacts WHERE artifact_id = ?")
    .get(artifactId) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToArtifactRecord(row);
}

export function listArtifactsForEvent(db: Database.Database, eventId: string): ArtifactRecord[] {
  const rows = db
    .prepare("SELECT * FROM artifacts WHERE event_id = ? ORDER BY created_at")
    .all(eventId) as Array<Record<string, unknown>>;
  return rows.map(rowToArtifactRecord);
}

function rowToArtifactRecord(row: Record<string, unknown>): ArtifactRecord {
  return {
    artifactId: row["artifact_id"] as string,
    eventId: row["event_id"] as string,
    role: row["role"] as ArtifactRole,
    label: row["label"] as string | null,
    mimeType: row["mime_type"] as string,
    originalFilename: row["original_filename"] as string | null,
    byteSize: row["byte_size"] as number,
    width: row["width"] as number | null,
    height: row["height"] as number | null,
    contentHash: row["content_hash"] as string,
    storageKey: row["storage_key"] as string,
    createdAt: row["created_at"] as string,
  };
}
