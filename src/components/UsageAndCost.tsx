import { formatCostCents, formatCostPrecise } from "../lib/format-cost.js";

interface UsageAndCostProps {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  inputCost: string | null;
  cachedInputCost: string | null;
  outputCost: string | null;
  totalCost: string | null;
}

function fmtTokens(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString();
}

type Row = {
  label: string;
  tokens: number | null;
  cost: string | null;
  total?: boolean;
  costDash?: boolean;
};

export function UsageAndCost({
  inputTokens,
  cachedInputTokens,
  outputTokens,
  reasoningTokens,
  totalTokens,
  inputCost,
  cachedInputCost,
  outputCost,
  totalCost,
}: UsageAndCostProps) {
  const rows: Row[] = [
    { label: "Input", tokens: inputTokens, cost: inputCost },
    { label: "Cached", tokens: cachedInputTokens, cost: cachedInputCost },
    { label: "Output", tokens: outputTokens, cost: outputCost },
    { label: "Reasoning", tokens: reasoningTokens, cost: null, costDash: true },
    { label: "Total", tokens: totalTokens, cost: totalCost, total: true },
  ];

  return (
    <section className="event-usage-cost" aria-label="Usage and cost">
      <h2 className="section-title">Usage &amp; Cost</h2>
      <div className="usage-cost-table" role="table">
        <div className="usage-cost-table__head" role="row">
          <span className="usage-cost-table__cell usage-cost-table__cell--type" role="columnheader">
            Type
          </span>
          <span className="usage-cost-table__cell usage-cost-table__cell--num" role="columnheader">
            Tokens
          </span>
          <span className="usage-cost-table__cell usage-cost-table__cell--num" role="columnheader">
            Cost
          </span>
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            className={`usage-cost-table__row${row.total ? " usage-cost-table__row--total" : ""}`}
            role="row"
          >
            <span className="usage-cost-table__cell usage-cost-table__cell--type" role="cell">
              {row.label}
            </span>
            <span
              className={`usage-cost-table__cell usage-cost-table__cell--num mono num${row.tokens === null ? " text-muted" : ""}`}
              role="cell"
            >
              {fmtTokens(row.tokens)}
            </span>
            <span
              className={`usage-cost-table__cell usage-cost-table__cell--num mono num${row.costDash || row.cost == null ? " text-muted" : ""}`}
              role="cell"
              title={row.costDash ? undefined : formatCostPrecise(row.cost) || undefined}
            >
              {row.costDash ? "—" : formatCostCents(row.cost)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
