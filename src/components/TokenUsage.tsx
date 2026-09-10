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
  const fmt = (n: number | null) => (n === null ? <span style={{ color: "#888" }}>—</span> : n.toLocaleString());

  return (
    <table style={{ borderCollapse: "collapse", fontSize: "0.9em" }}>
      <tbody>
        <tr>
          <td style={{ paddingRight: 16, color: "#888" }}>Input tokens</td>
          <td style={{ fontFamily: "monospace" }}>{fmt(inputTokens)}</td>
        </tr>
        {cachedInputTokens !== null && (
          <tr>
            <td style={{ paddingRight: 16, color: "#888" }}>└ Cached input</td>
            <td style={{ fontFamily: "monospace" }}>{fmt(cachedInputTokens)}</td>
          </tr>
        )}
        <tr>
          <td style={{ paddingRight: 16, color: "#888" }}>Output tokens</td>
          <td style={{ fontFamily: "monospace" }}>{fmt(outputTokens)}</td>
        </tr>
        {reasoningTokens !== null && (
          <tr>
            <td style={{ paddingRight: 16, color: "#888" }}>└ Reasoning</td>
            <td style={{ fontFamily: "monospace" }}>{fmt(reasoningTokens)}</td>
          </tr>
        )}
        <tr>
          <td style={{ paddingRight: 16, color: "#888" }}>Total tokens</td>
          <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>{fmt(totalTokens)}</td>
        </tr>
      </tbody>
    </table>
  );
}
