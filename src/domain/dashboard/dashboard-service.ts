import Decimal from "decimal.js";
import type Database from "better-sqlite3";

export interface DashboardStats {
  totalEvents: number;
  successEvents: number;
  errorEvents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: string;
  missingPricingModels: number;
  recentEvents: Array<{
    eventId: string;
    applicationId: string;
    applicationName: string;
    status: string;
    environment: string;
    feature: string;
    operation: string;
    subjectId: string | null;
    subjectLabel: string | null;
    provider: string;
    requestedModel: string;
    inputTokens: number | null;
    cachedInputTokens: number | null;
    outputTokens: number | null;
    timestamp: string;
    totalCost: string | null;
  }>;
}

export function getDashboardStats(db: Database.Database): DashboardStats {
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_count,
      SUM(COALESCE(input_tokens, 0)) as total_input_tokens,
      SUM(COALESCE(output_tokens, 0)) as total_output_tokens
    FROM events
  `).get() as Record<string, unknown>;

  // Use Decimal.js to sum costs to avoid floating-point accumulation errors
  const costRows = db.prepare(
    "SELECT total_cost FROM events WHERE total_cost IS NOT NULL"
  ).all() as Array<{ total_cost: string }>;
  const totalCost = costRows.reduce(
    (acc, row) => acc.plus(new Decimal(row.total_cost)),
    new Decimal(0)
  );

  const missingRow = db.prepare(`
    SELECT COUNT(DISTINCT provider || '|' || COALESCE(reported_model, requested_model)) as cnt
    FROM events WHERE pricing_id IS NULL
  `).get() as { cnt: number };

  const recentRows = db.prepare(`
    SELECT e.event_id, e.application_id, COALESCE(a.display_name, e.application_id) as application_name,
           e.status, e.environment, e.feature, e.operation, e.subject_id, e.subject_label,
           e.provider, e.requested_model,
           e.input_tokens, e.cached_input_tokens, e.output_tokens, e.timestamp, e.total_cost
    FROM events e
    LEFT JOIN applications a ON a.id = e.application_id
    ORDER BY e.timestamp DESC
    LIMIT 10
  `).all() as Array<Record<string, unknown>>;

  return {
    totalEvents: (totals["total"] as number) ?? 0,
    successEvents: (totals["success_count"] as number) ?? 0,
    errorEvents: (totals["error_count"] as number) ?? 0,
    totalInputTokens: (totals["total_input_tokens"] as number) ?? 0,
    totalOutputTokens: (totals["total_output_tokens"] as number) ?? 0,
    totalCost: totalCost.toFixed(6),
    missingPricingModels: missingRow.cnt ?? 0,
    recentEvents: recentRows.map((r) => ({
      eventId: r["event_id"] as string,
      applicationId: r["application_id"] as string,
      applicationName: r["application_name"] as string,
      status: r["status"] as string,
      environment: r["environment"] as string,
      feature: r["feature"] as string,
      operation: r["operation"] as string,
      subjectId: (r["subject_id"] as string | null) ?? null,
      subjectLabel: (r["subject_label"] as string | null) ?? null,
      provider: r["provider"] as string,
      requestedModel: r["requested_model"] as string,
      inputTokens: r["input_tokens"] as number | null,
      cachedInputTokens: r["cached_input_tokens"] as number | null,
      outputTokens: r["output_tokens"] as number | null,
      timestamp: r["timestamp"] as string,
      totalCost: r["total_cost"] as string | null,
    })),
  };
}
