import { formatCostCents, formatCostPrecise } from "../lib/format-cost.js";

interface CostBreakdownProps {
  inputCost: string | null;
  cachedInputCost: string | null;
  outputCost: string | null;
  totalCost: string | null;
  pricingId: string | null;
  hasUsage: boolean;
  /** Compact metric grid (event detail). Default true. */
  compact?: boolean;
  /** Hide pricing status line (shown elsewhere). */
  hidePricingState?: boolean;
}

export function CostBreakdown({
  inputCost,
  cachedInputCost,
  outputCost,
  totalCost,
  pricingId,
  hasUsage,
  compact = true,
  hidePricingState = false,
}: CostBreakdownProps) {
  let pricingState: React.ReactNode = null;
  if (!hidePricingState) {
    if (pricingId) {
      pricingState = (
        <span className="text-success text-sm">
          Priced
        </span>
      );
    } else if (hasUsage) {
      pricingState = <span className="text-warn text-sm">Missing pricing</span>;
    } else {
      pricingState = <span className="text-muted text-sm">No usage</span>;
    }
  }

  if (!compact) {
    return (
      <div>
        {pricingState ? (
          <div className="cluster" style={{ marginBottom: "var(--space-2)" }}>
            {pricingState}
            <span className="text-muted text-sm">shown in cents</span>
          </div>
        ) : null}
        <table className="meta-table">
          <tbody>
            <tr>
              <td>Input cost</td>
              <td className="mono num" title={formatCostPrecise(inputCost)}>
                {formatCostCents(inputCost)}
              </td>
            </tr>
            <tr>
              <td>Cached input cost</td>
              <td className="mono num" title={formatCostPrecise(cachedInputCost)}>
                {formatCostCents(cachedInputCost)}
              </td>
            </tr>
            <tr>
              <td>Output cost</td>
              <td className="mono num" title={formatCostPrecise(outputCost)}>
                {formatCostCents(outputCost)}
              </td>
            </tr>
            <tr>
              <td style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>Total cost</td>
              <td
                className="mono num"
                style={{ fontWeight: 600, borderTop: "1px solid var(--border)", paddingTop: 8 }}
                title={formatCostPrecise(totalCost)}
              >
                {formatCostCents(totalCost)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const items: Array<{ label: string; value: string | null; emphasize?: boolean }> = [
    { label: "Input", value: inputCost },
    { label: "Cached", value: cachedInputCost },
    { label: "Output", value: outputCost },
    { label: "Total", value: totalCost, emphasize: true },
  ];

  return (
    <div>
      {pricingState ? (
        <div className="cluster" style={{ marginBottom: "var(--space-2)" }}>
          {pricingState}
          <span className="text-muted text-sm">cents</span>
        </div>
      ) : null}
      <div className="metric-breakdown" aria-label="Cost breakdown">
        {items.map((item) => (
          <div
            key={item.label}
            className={`metric-breakdown__item${item.emphasize ? " metric-breakdown__item--total" : ""}`}
          >
            <div
              className={`metric-breakdown__value num mono${item.value == null ? " text-muted" : ""}`}
              title={formatCostPrecise(item.value) || undefined}
            >
              {formatCostCents(item.value)}
            </div>
            <div className="metric-breakdown__label">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
