import { formatCostCents } from "../lib/format-cost.js";

interface CostBreakdownProps {
  inputCost: string | null;
  cachedInputCost: string | null;
  outputCost: string | null;
  totalCost: string | null;
  pricingId: string | null;
  hasUsage: boolean;
}

export function CostBreakdown({
  inputCost,
  cachedInputCost,
  outputCost,
  totalCost,
  pricingId,
  hasUsage,
}: CostBreakdownProps) {
  let pricingState: React.ReactNode;
  if (pricingId) {
    pricingState = (
      <span className="text-success">
        Priced (id: <span className="mono">{pricingId.slice(0, 8)}…</span>)
      </span>
    );
  } else if (hasUsage) {
    pricingState = <span className="text-warn">⚠ Missing pricing</span>;
  } else {
    pricingState = <span className="text-muted">No usage</span>;
  }

  return (
    <div>
      <div className="cluster" style={{ marginBottom: "var(--space-2)" }}>
        {pricingState}
        <span className="text-muted text-sm">shown in cents</span>
      </div>
      <table className="meta-table">
        <tbody>
          <tr>
            <td>Input cost</td>
            <td className="mono num">{formatCostCents(inputCost)}</td>
          </tr>
          <tr>
            <td>Cached input cost</td>
            <td className="mono num">{formatCostCents(cachedInputCost)}</td>
          </tr>
          <tr>
            <td>Output cost</td>
            <td className="mono num">{formatCostCents(outputCost)}</td>
          </tr>
          <tr>
            <td style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>Total cost</td>
            <td className="mono num" style={{ fontWeight: 600, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
              {formatCostCents(totalCost)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
