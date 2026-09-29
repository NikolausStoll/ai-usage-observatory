import { formatCostCents } from "../lib/format-cost.js";

interface DataQualityHintsProps {
  event: Record<string, unknown>;
}

export function DataQualityHints({ event }: DataQualityHintsProps) {
  const hints: string[] = [];

  const inputTokens = event["input_tokens"] as number | null;
  const outputTokens = event["output_tokens"] as number | null;
  const cachedInputTokens = event["cached_input_tokens"] as number | null;
  const pricingId = event["pricing_id"] as string | null;
  const totalCost = event["total_cost"] as string | null;
  const status = event["status"] as string;

  if (inputTokens === null) hints.push("Missing input tokens");
  if (outputTokens === null) hints.push("Missing output tokens");

  if (
    inputTokens !== null &&
    cachedInputTokens !== null &&
    cachedInputTokens > inputTokens
  ) {
    hints.push(`Cached input tokens (${cachedInputTokens}) exceeds input tokens (${inputTokens})`);
  }

  const hasUsage = inputTokens !== null || outputTokens !== null;
  if (hasUsage && !pricingId) {
    hints.push("No pricing matched for this event — cost is unavailable");
  }

  if (status === "error" && totalCost !== null) {
    const cost = parseFloat(totalCost);
    if (cost > 0) {
      hints.push(`Error event incurred cost of ${formatCostCents(totalCost)}`);
    }
  }

  if (hints.length === 0) return null;

  return (
    <div style={{
      background: "#2a1f00",
      border: "1px solid #ff9800",
      borderRadius: "4px",
      padding: "12px 16px",
    }}>
      <div style={{ color: "#ff9800", fontWeight: "bold", marginBottom: 8 }}>
        ⚠ Data quality hints
      </div>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {hints.map((h, i) => (
          <li key={i} style={{ color: "#ffc107", fontSize: "0.9em", marginBottom: 4 }}>{h}</li>
        ))}
      </ul>
    </div>
  );
}
