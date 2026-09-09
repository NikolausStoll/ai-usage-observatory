import type Database from "better-sqlite3";
import type { IngestEvent } from "./event-schema.js";

export interface IngestResult {
  eventId: string;
  received: boolean;
  duplicate: boolean;
}

export function ingestEvent(
  db: Database.Database,
  event: IngestEvent,
  applicationId: string
): IngestResult {
  const existing = db
    .prepare("SELECT event_id FROM events WHERE event_id = ?")
    .get(event.eventId);

  if (existing) {
    return { eventId: event.eventId, received: false, duplicate: true };
  }

  const receivedAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO events (
      event_id, application_id, received_at, timestamp, duration_ms,
      environment, application_version, feature, operation, operation_id,
      workflow_id, attempt_number, status, provider, requested_model,
      reported_model, prompt_id, prompt_version, request_config,
      request_input, request_raw, request_metadata,
      response_output, response_raw, response_metadata,
      input_tokens, cached_input_tokens, output_tokens, reasoning_tokens, total_tokens,
      raw_usage, http_status, error_type, error_message, error_metadata,
      metadata, metrics
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?
    )
  `).run(
    event.eventId,
    applicationId,
    receivedAt,
    event.timestamp,
    event.durationMs,
    event.environment,
    event.applicationVersion ?? null,
    event.feature,
    event.operation,
    event.operationId,
    event.workflowId ?? null,
    event.attemptNumber,
    event.status,
    event.provider,
    event.requestedModel,
    event.reportedModel ?? null,
    event.promptId ?? null,
    event.promptVersion ?? null,
    event.requestConfig ? JSON.stringify(event.requestConfig) : null,
    event.request?.input !== undefined
      ? JSON.stringify(event.request.input)
      : null,
    event.request?.raw !== undefined ? JSON.stringify(event.request.raw) : null,
    event.request?.metadata !== undefined
      ? JSON.stringify(event.request.metadata)
      : null,
    event.response?.output !== undefined
      ? JSON.stringify(event.response.output)
      : null,
    event.response?.raw !== undefined
      ? JSON.stringify(event.response.raw)
      : null,
    event.response?.metadata !== undefined
      ? JSON.stringify(event.response.metadata)
      : null,
    event.usage?.inputTokens ?? null,
    event.usage?.cachedInputTokens ?? null,
    event.usage?.outputTokens ?? null,
    event.usage?.reasoningTokens ?? null,
    event.usage?.totalTokens ?? null,
    event.usage?.rawUsage !== undefined
      ? JSON.stringify(event.usage.rawUsage)
      : null,
    event.httpStatus ?? null,
    event.error?.type ?? null,
    event.error?.message ?? null,
    event.error?.metadata !== undefined
      ? JSON.stringify(event.error.metadata)
      : null,
    event.metadata !== undefined ? JSON.stringify(event.metadata) : null,
    event.metrics !== undefined ? JSON.stringify(event.metrics) : null
  );

  return { eventId: event.eventId, received: true, duplicate: false };
}

export function getEvent(
  db: Database.Database,
  eventId: string
): Record<string, unknown> | null {
  const row = db
    .prepare("SELECT * FROM events WHERE event_id = ?")
    .get(eventId) as Record<string, unknown> | undefined;
  if (!row) return null;

  const jsonFields = [
    "request_config",
    "request_input",
    "request_raw",
    "request_metadata",
    "response_output",
    "response_raw",
    "response_metadata",
    "raw_usage",
    "error_metadata",
    "metadata",
    "metrics",
  ];

  for (const field of jsonFields) {
    if (typeof row[field] === "string") {
      try {
        row[field] = JSON.parse(row[field] as string);
      } catch {
        // keep as string if parse fails
      }
    }
  }

  return row;
}
