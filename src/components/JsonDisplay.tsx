interface JsonDisplayProps {
  value: unknown;
  label?: string;
}

export function JsonDisplay({ value, label }: JsonDisplayProps) {
  if (value === null || value === undefined) {
    return (
      <div>
        {label && <span style={{ color: "#888", marginRight: 8 }}>{label}:</span>}
        <span style={{ color: "#aaa" }}>—</span>
      </div>
    );
  }

  return (
    <div>
      {label && <div style={{ color: "#888", fontSize: "0.85em", marginBottom: 4 }}>{label}</div>}
      <pre style={{
        background: "#1a1a1a",
        color: "#e0e0e0",
        padding: "12px",
        borderRadius: "4px",
        overflow: "auto",
        fontSize: "0.82em",
        margin: 0,
        maxHeight: "400px",
        border: "1px solid #333",
      }}>
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
