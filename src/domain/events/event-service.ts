import type Database from "better-sqlite3";
import type { IngestEvent } from "./event-schema.js";
import { applyPricingToEvent } from "../pricing/pricing-service.js";
import {
  DEFAULT_EVENT_PAGE_SIZE,
  MAX_EVENT_PAGE_SIZE,
  type EventSortBy,
  type EventSortDir,
  type EventListItem,
} from "./event-list.js";

export type { EventSortBy, EventSortDir, EventListItem } from "./event-list.js";
export { DEFAULT_EVENT_PAGE_SIZE, MAX_EVENT_PAGE_SIZE } from "./event-list.js";

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

  // Apply pricing if available
  applyPricingToEvent(
    db,
    event.eventId,
    event.provider,
    event.requestedModel,
    event.reportedModel ?? null,
    event.timestamp,
    event.usage?.inputTokens ?? null,
    event.usage?.cachedInputTokens ?? null,
    event.usage?.outputTokens ?? null
  );

  return { eventId: event.eventId, received: true, duplicate: false };
}

const SORT_COLUMNS: Record<EventSortBy, string> = {
  timestamp: "e.timestamp",
  status: "e.status",
  applicationName: "a.display_name",
  environment: "e.environment",
  feature: "e.feature",
  operation: "e.operation",
  requestedModel: "e.requested_model",
  inputTokens: "e.input_tokens",
  cachedInputTokens: "e.cached_input_tokens",
  outputTokens: "e.output_tokens",
  totalCost: "CAST(e.total_cost AS REAL)",
  durationMs: "e.duration_ms",
};

export interface EventListFilters {
  applicationId?: string;
  /** Case-insensitive substring match against application display name. */
  application?: string;
  status?: string;
  environment?: string;
  feature?: string;
  operation?: string;
  requestedModel?: string;
  sortBy?: EventSortBy;
  sortDir?: EventSortDir;
}

export interface EventFilterFacets {
  applications: Array<{ id: string; name: string }>;
  environments: string[];
  featureOps: Array<{ feature: string; operation: string }>;
  models: string[];
}

export interface EventListResult {
  items: EventListItem[];
  total: number;
  page: number;
  pageSize: number;
  facets: EventFilterFacets;
}

export function getEventFilterFacets(db: Database.Database): EventFilterFacets {
  const applications = db
    .prepare(
      `SELECT DISTINCT a.id as id, a.display_name as name
       FROM events e
       JOIN applications a ON a.id = e.application_id
       ORDER BY a.display_name COLLATE NOCASE`
    )
    .all() as Array<{ id: string; name: string }>;

  const environments = (
    db
      .prepare(
        `SELECT DISTINCT environment FROM events
         WHERE environment IS NOT NULL AND TRIM(environment) != ''
         ORDER BY environment COLLATE NOCASE`
      )
      .all() as Array<{ environment: string }>
  ).map((r) => r.environment);

  const featureOps = db
    .prepare(
      `SELECT DISTINCT feature, operation FROM events
       WHERE feature IS NOT NULL AND TRIM(feature) != ''
       ORDER BY feature COLLATE NOCASE, operation COLLATE NOCASE`
    )
    .all() as Array<{ feature: string; operation: string }>;

  const models = (
    db
      .prepare(
        `SELECT DISTINCT requested_model FROM events
         WHERE requested_model IS NOT NULL AND TRIM(requested_model) != ''
         ORDER BY requested_model COLLATE NOCASE`
      )
      .all() as Array<{ requested_model: string }>
  ).map((r) => r.requested_model);

  return { applications, environments, featureOps, models };
}

export function listEvents(
  db: Database.Database,
  filters: EventListFilters = {},
  page = 1,
  pageSize = DEFAULT_EVENT_PAGE_SIZE
): EventListResult {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.applicationId) {
    conditions.push("e.application_id = ?");
    params.push(filters.applicationId);
  } else if (filters.application) {
    conditions.push("LOWER(COALESCE(a.display_name, e.application_id)) LIKE ?");
    params.push(`%${filters.application.toLowerCase()}%`);
  }
  if (filters.status) {
    conditions.push("e.status = ?");
    params.push(filters.status);
  }
  if (filters.environment) {
    conditions.push("e.environment = ?");
    params.push(filters.environment);
  }
  if (filters.feature) {
    conditions.push("e.feature = ?");
    params.push(filters.feature);
  }
  if (filters.operation) {
    conditions.push("e.operation = ?");
    params.push(filters.operation);
  }
  if (filters.requestedModel) {
    conditions.push("e.requested_model = ?");
    params.push(filters.requestedModel);
  }

  const safePageSize = Math.min(
    Math.max(1, Math.floor(pageSize) || DEFAULT_EVENT_PAGE_SIZE),
    MAX_EVENT_PAGE_SIZE
  );
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const offset = (page - 1) * safePageSize;

  const sortBy = filters.sortBy && SORT_COLUMNS[filters.sortBy] ? filters.sortBy : "timestamp";
  const sortDir = filters.sortDir === "asc" ? "ASC" : "DESC";
  const orderBy = `${SORT_COLUMNS[sortBy]} ${sortDir}`;
  const fromClause = `
    FROM events e
    LEFT JOIN applications a ON a.id = e.application_id
    LEFT JOIN (
      SELECT event_id,
             COUNT(*) AS artifact_count,
             SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS artifact_deleted_count
      FROM artifacts
      GROUP BY event_id
    ) ac ON ac.event_id = e.event_id
  `;

  const countRow = db
    .prepare(`SELECT COUNT(*) as cnt ${fromClause} ${where}`)
    .get(...params) as { cnt: number };
  const total = countRow.cnt;

  const rows = db
    .prepare(
      `
    SELECT e.event_id, e.application_id, a.display_name as application_name,
           e.status, e.environment, e.feature, e.operation,
           e.provider, e.requested_model, e.reported_model,
           e.input_tokens, e.cached_input_tokens, e.output_tokens,
           e.total_cost, e.pricing_id,
           e.timestamp, e.duration_ms,
           COALESCE(ac.artifact_count, 0) AS artifact_count,
           COALESCE(ac.artifact_deleted_count, 0) AS artifact_deleted_count
    ${fromClause}
    ${where}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?
  `
    )
    .all(...params, safePageSize, offset) as Array<Record<string, unknown>>;

  return {
    items: rows.map((r) => ({
      eventId: r["event_id"] as string,
      applicationId: r["application_id"] as string,
      applicationName: (r["application_name"] as string) ?? (r["application_id"] as string),
      status: r["status"] as string,
      environment: r["environment"] as string,
      feature: r["feature"] as string,
      operation: r["operation"] as string,
      provider: r["provider"] as string,
      requestedModel: r["requested_model"] as string,
      reportedModel: r["reported_model"] as string | null,
      inputTokens: r["input_tokens"] as number | null,
      cachedInputTokens: r["cached_input_tokens"] as number | null,
      outputTokens: r["output_tokens"] as number | null,
      totalCost: r["total_cost"] as string | null,
      pricingId: r["pricing_id"] as string | null,
      timestamp: r["timestamp"] as string,
      durationMs: r["duration_ms"] as number,
      artifactCount: Number(r["artifact_count"] ?? 0),
      artifactDeletedCount: Number(r["artifact_deleted_count"] ?? 0),
    })),
    total,
    page,
    pageSize: safePageSize,
    facets: getEventFilterFacets(db),
  };
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
