import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db/database.js";
import {
  getArtifact,
  deleteArtifact,
} from "../domain/artifacts/artifact-service.js";
import { getArtifactStorage } from "../domain/artifacts/artifact-storage.js";
import { isArtifactDeleted } from "../domain/artifacts/artifact-schema.js";

export const fetchArtifactData = createServerFn({ method: "GET", strict: false })
  .validator(z.string())
  .handler(async ({ data: artifactId }) => {
    const db = getDb();
    const artifact = getArtifact(db, artifactId);
    if (!artifact) return null;
    if (isArtifactDeleted(artifact)) {
      return { deleted: true as const, artifactId: artifact.artifactId };
    }

    const storage = getArtifactStorage();
    const buffer = await storage.retrieve(artifact.storageKey);

    return {
      deleted: false as const,
      artifactId: artifact.artifactId,
      mimeType: artifact.mimeType,
      byteSize: artifact.byteSize,
      width: artifact.width,
      height: artifact.height,
      role: artifact.role,
      label: artifact.label,
      originalFilename: artifact.originalFilename,
      contentHash: artifact.contentHash,
      createdAt: artifact.createdAt,
      dataBase64: buffer.toString("base64"),
    };
  });

export const deleteArtifactFn = createServerFn({ method: "POST", strict: false })
  .validator(z.string())
  .handler(async ({ data: artifactId }) => {
    const db = getDb();
    const storage = getArtifactStorage();
    return deleteArtifact(db, storage, artifactId);
  });
