import { getDb } from "../../db/database.js";
import { authenticateRequest } from "../../domain/auth/auth.js";
import { uploadArtifact, getArtifact } from "../../domain/artifacts/artifact-service.js";
import { getArtifactStorage } from "../../domain/artifacts/artifact-storage.js";
import { ArtifactRoleSchema } from "../../domain/artifacts/artifact-schema.js";

const MAX_ARTIFACT_SIZE_BYTES = parseInt(
  process.env["MAX_ARTIFACT_SIZE_BYTES"] ?? String(25 * 1024 * 1024),
  10
);

export async function handleUploadArtifact(
  request: Request,
  eventId: string
): Promise<Response> {
  const db = getDb();

  const auth = authenticateRequest(db, request.headers.get("authorization") ?? undefined);
  if (!auth) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Verify event exists and belongs to this application
  const event = db
    .prepare("SELECT event_id, application_id FROM events WHERE event_id = ?")
    .get(eventId) as { event_id: string; application_id: string } | undefined;

  if (!event) {
    return Response.json({ error: "event_not_found" }, { status: 404 });
  }

  if (event.application_id !== auth.applicationId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const roleRaw = formData.get("role");
  const label = formData.get("label");
  const file = formData.get("file");

  if (!roleRaw || typeof roleRaw !== "string") {
    return Response.json({ error: "validation_error", details: ["role is required"] }, { status: 400 });
  }

  const roleResult = ArtifactRoleSchema.safeParse(roleRaw);
  if (!roleResult.success) {
    return Response.json(
      { error: "validation_error", details: ["role must be 'input' or 'output'"] },
      { status: 400 }
    );
  }

  if (!file || !(file instanceof File)) {
    return Response.json({ error: "validation_error", details: ["file is required"] }, { status: 400 });
  }

  if (file.size > MAX_ARTIFACT_SIZE_BYTES) {
    return Response.json({ error: "payload_too_large", maxBytes: MAX_ARTIFACT_SIZE_BYTES }, { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const data = Buffer.from(arrayBuffer);

  // Check size again after reading (content-length may be absent)
  if (data.length > MAX_ARTIFACT_SIZE_BYTES) {
    return Response.json({ error: "payload_too_large", maxBytes: MAX_ARTIFACT_SIZE_BYTES }, { status: 413 });
  }

  const mimeType = file.type || "application/octet-stream";
  const originalFilename = file.name && file.name !== "blob" ? file.name : undefined;

  try {
    const result = await uploadArtifact(db, getArtifactStorage(), {
      eventId,
      role: roleResult.data,
      label: typeof label === "string" ? label : undefined,
      mimeType,
      originalFilename,
      data,
    });

    return Response.json(result, { status: 200 });
  } catch (err) {
    console.error("Artifact upload error:", err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function handleServeArtifact(
  request: Request,
  artifactId: string
): Promise<Response> {
  const db = getDb();

  const auth = authenticateRequest(db, request.headers.get("authorization") ?? undefined);
  if (!auth) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const artifact = getArtifact(db, artifactId);
  if (!artifact) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  // Verify the event belongs to this application
  const event = db
    .prepare("SELECT application_id FROM events WHERE event_id = ?")
    .get(artifact.eventId) as { application_id: string } | undefined;

  if (!event || event.application_id !== auth.applicationId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const data = await getArtifactStorage().retrieve(artifact.storageKey);
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Length": String(artifact.byteSize),
        "Content-Disposition": `inline; filename="${artifact.originalFilename ?? artifactId}"`,
      },
    });
  } catch {
    return Response.json({ error: "artifact_not_found" }, { status: 404 });
  }
}
