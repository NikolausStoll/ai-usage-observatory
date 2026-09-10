import { getDb } from "../../db/database.js";
import { IngestEventSchema } from "../../domain/events/event-schema.js";
import { ingestEvent } from "../../domain/events/event-service.js";
import { authenticateRequest } from "../../domain/auth/auth.js";

function log(obj: Record<string, unknown>): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj }));
}

const MAX_EVENT_SIZE_BYTES = parseInt(
  process.env["MAX_EVENT_SIZE_BYTES"] ?? String(1 * 1024 * 1024),
  10
);

export async function handleIngestEvent(request: Request): Promise<Response> {
  const auth = authenticateRequest(getDb(), request.headers.get("authorization") ?? undefined);
  if (!auth) {
    log({ level: "warn", event: "auth_failed", path: "POST /api/v1/events" });
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_EVENT_SIZE_BYTES) {
    return Response.json({ error: "payload_too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_EVENT_SIZE_BYTES) {
      return Response.json({ error: "payload_too_large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "validation_error", details: ["Invalid JSON"] },
      { status: 400 }
    );
  }

  const result = IngestEventSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      {
        error: "validation_error",
        details: result.error.errors.map((e) => ({
          path: e.path,
          message: e.message,
        })),
      },
      { status: 400 }
    );
  }

  const ingestResult = ingestEvent(getDb(), result.data, auth.applicationId);

  log({
    level: "info",
    event: "event_ingested",
    eventId: ingestResult.eventId,
    applicationId: auth.applicationId,
    duplicate: ingestResult.duplicate,
  });

  return Response.json(ingestResult, { status: 200 });
}
