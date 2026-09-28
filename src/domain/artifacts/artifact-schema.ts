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
}
