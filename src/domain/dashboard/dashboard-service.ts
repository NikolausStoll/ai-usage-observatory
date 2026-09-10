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
    provider: string;
    requestedModel: string;
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
      SUM(COALESCE(output_tokens, 0)) as total_output_tokens,
      SUM(CAST(COALESCE(total_cost, '0') AS REAL)) as total_cost
    FROM events
  `).get() as Record<string, unknown>;

  const missingRow = db.prepare(`
    SELECT COUNT(DISTINCT provider || '|' || COALESCE(reported_model, requested_model)) as cnt
    FROM events WHERE pricing_id IS NULL
  `).get() as { cnt: number };

  const recentRows = db.prepare(`
    SELECT e.event_id, e.application_id, COALESCE(a.display_name, e.application_id) as application_name,
           e.status, e.provider, e.requested_model, e.timestamp, e.total_cost
    FROM events e
    LEFT JOIN applications a ON a.id = e.application_id
    ORDER BY e.timestamp DESC
    LIMIT 10
  `).all() as Array<Record<string, unknown>>;

  const totalCostNum = (totals["total_cost"] as number) ?? 0;

  return {
    totalEvents: (totals["total"] as number) ?? 0,
    successEvents: (totals["success_count"] as number) ?? 0,
    errorEvents: (totals["error_count"] as number) ?? 0,
    totalInputTokens: (totals["total_input_tokens"] as number) ?? 0,
    totalOutputTokens: (totals["total_output_tokens"] as number) ?? 0,
    totalCost: totalCostNum.toFixed(6),
    missingPricingModels: missingRow.cnt ?? 0,
    recentEvents: recentRows.map((r) => ({
      eventId: r["event_id"] as string,
      applicationId: r["application_id"] as string,
      applicationName: r["application_name"] as string,
      status: r["status"] as string,
      provider: r["provider"] as string,
      requestedModel: r["requested_model"] as string,
      timestamp: r["timestamp"] as string,
      totalCost: r["total_cost"] as string | null,
    })),
  };
}
