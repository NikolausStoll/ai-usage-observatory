interface JsonDisplayProps {
  value: unknown;
  label?: string;
}

export function JsonDisplay({ value, label }: JsonDisplayProps) {
  if (value === null || value === undefined) {
    return (
      <div>
        {label && <span className="text-muted" style={{ marginRight: 8 }}>{label}:</span>}
        <span className="text-muted">—</span>
      </div>
    );
  }

  return (
    <div>
      {label && <div className="text-muted text-sm" style={{ marginBottom: 4 }}>{label}</div>}
      <pre className="code-block">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
