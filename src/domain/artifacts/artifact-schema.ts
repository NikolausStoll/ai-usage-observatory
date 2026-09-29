import { z } from "zod";

export const ArtifactRoleSchema = z.enum(["input", "output"]);
export type ArtifactRole = z.infer<typeof ArtifactRoleSchema>;

export interface ArtifactRecord {
  artifactId: string;
  eventId: string;
  role: ArtifactRole;
  label: string | null;
  mimeType: string;
  originalFilename: string | null;
  byteSize: number;
  width: number | null;
  height: number | null;
  contentHash: string;
  storageKey: string;
  createdAt: string;
  /** ISO timestamp when binary was soft-deleted; null if still available. */
  deletedAt: string | null;
}

export function isArtifactDeleted(artifact: Pick<ArtifactRecord, "deletedAt">): boolean {
  return artifact.deletedAt != null;
}
