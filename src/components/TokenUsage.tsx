interface TokenUsageProps {
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
}

export function TokenUsage({
  inputTokens,
  cachedInputTokens,
  outputTokens,
  reasoningTokens,
  totalTokens,
}: TokenUsageProps) {
  const fmt = (n: number | null) =>
    n === null ? <span className="text-muted">—</span> : <span className="num">{n.toLocaleString()}</span>;

  return (
    <table className="meta-table">
      <tbody>
        <tr>
          <td>Input tokens</td>
          <td className="mono">{fmt(inputTokens)}</td>
        </tr>
        {cachedInputTokens !== null && (
          <tr>
            <td>└ Cached input</td>
            <td className="mono">{fmt(cachedInputTokens)}</td>
          </tr>
        )}
        <tr>
          <td>Output tokens</td>
          <td className="mono">{fmt(outputTokens)}</td>
        </tr>
        {reasoningTokens !== null && (
          <tr>
            <td>└ Reasoning</td>
            <td className="mono">{fmt(reasoningTokens)}</td>
          </tr>
        )}
        <tr>
          <td>Total tokens</td>
          <td className="mono" style={{ fontWeight: 600 }}>{fmt(totalTokens)}</td>
        </tr>
      </tbody>
    </table>
  );
}
