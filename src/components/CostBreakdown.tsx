interface CostBreakdownProps {
  inputCost: string | null;
  cachedInputCost: string | null;
  outputCost: string | null;
  totalCost: string | null;
  pricingId: string | null;
  hasUsage: boolean;
}

function fmtCost(c: string | null): string {
  if (c === null) return "—";
  const n = parseFloat(c);
  if (isNaN(n)) return c;
  if (n === 0) return "$0.000000";
  return "$" + n.toFixed(6);
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
    pricingState = <span style={{ color: "#4caf50" }}>Priced (id: {pricingId.slice(0, 8)}…)</span>;
  } else if (hasUsage) {
    pricingState = <span style={{ color: "#ff9800" }}>⚠ Missing pricing</span>;
  } else {
    pricingState = <span style={{ color: "#888" }}>No usage</span>;
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>{pricingState}</div>
      <table style={{ borderCollapse: "collapse", fontSize: "0.9em" }}>
        <tbody>
          <tr>
            <td style={{ paddingRight: 16, color: "#888" }}>Input cost</td>
            <td style={{ fontFamily: "monospace" }}>{fmtCost(inputCost)}</td>
          </tr>
          <tr>
            <td style={{ paddingRight: 16, color: "#888" }}>Cached input cost</td>
            <td style={{ fontFamily: "monospace" }}>{fmtCost(cachedInputCost)}</td>
          </tr>
          <tr>
            <td style={{ paddingRight: 16, color: "#888" }}>Output cost</td>
            <td style={{ fontFamily: "monospace" }}>{fmtCost(outputCost)}</td>
          </tr>
          <tr style={{ borderTop: "1px solid #333" }}>
            <td style={{ paddingRight: 16, color: "#888", paddingTop: 4 }}>Total cost</td>
            <td style={{ fontFamily: "monospace", fontWeight: "bold", paddingTop: 4 }}>{fmtCost(totalCost)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
