interface TokenUsageProps {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  /** Compact metric grid (event detail). Default true. */
  compact?: boolean;
}

function fmt(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString();
}

export function TokenUsage({
  inputTokens,
  cachedInputTokens,
  outputTokens,
  reasoningTokens,
  totalTokens,
  compact = true,
}: TokenUsageProps) {
  if (!compact) {
    return (
      <table className="meta-table">
        <tbody>
          <tr>
            <td>Input tokens</td>
            <td className="mono num">{fmt(inputTokens)}</td>
          </tr>
          {cachedInputTokens !== null && (
            <tr>
              <td>└ Cached input</td>
              <td className="mono num">{fmt(cachedInputTokens)}</td>
            </tr>
          )}
          <tr>
            <td>Output tokens</td>
            <td className="mono num">{fmt(outputTokens)}</td>
          </tr>
          {reasoningTokens !== null && (
            <tr>
              <td>└ Reasoning</td>
              <td className="mono num">{fmt(reasoningTokens)}</td>
            </tr>
          )}
          <tr>
            <td>Total tokens</td>
            <td className="mono num" style={{ fontWeight: 600 }}>
              {fmt(totalTokens)}
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  const items: Array<{ label: string; value: number | null; emphasize?: boolean }> = [
    { label: "Input", value: inputTokens },
    { label: "Cached", value: cachedInputTokens },
    { label: "Output", value: outputTokens },
    { label: "Reasoning", value: reasoningTokens },
    { label: "Total", value: totalTokens, emphasize: true },
  ];

  return (
    <div className="metric-breakdown" aria-label="Token usage">
      {items.map((item) => (
        <div
          key={item.label}
          className={`metric-breakdown__item${item.emphasize ? " metric-breakdown__item--total" : ""}`}
        >
          <div
            className={`metric-breakdown__value num mono${item.value === null ? " text-muted" : ""}`}
          >
            {fmt(item.value)}
          </div>
          <div className="metric-breakdown__label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
