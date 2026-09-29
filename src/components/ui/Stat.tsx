interface StatProps {
  value: string | number;
  label: string;
}

export function Stat({ value, label }: StatProps) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
