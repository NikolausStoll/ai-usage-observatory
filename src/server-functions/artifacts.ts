import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db/database.js";
import { getArtifact } from "../domain/artifacts/artifact-service.js";
import { getArtifactStorage } from "../domain/artifacts/artifact-storage.js";

export const fetchArtifactData = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.string().parse(input))
  .handler(async ({ data: artifactId }) => {
    const db = getDb();
    const artifact = getArtifact(db, artifactId);
    if (!artifact) return null;

    const storage = getArtifactStorage();
    const buffer = await storage.retrieve(artifact.storageKey);

    return {
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
