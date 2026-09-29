import { formatCostDisplay } from "../lib/format-cost.js";

interface CostDisplayProps {
  usd: string | null | undefined;
  className?: string;
}

/** Human-friendly cost with precise USD in the title attribute. */
export function CostDisplay({ usd, className }: CostDisplayProps) {
  const { label, title } = formatCostDisplay(usd);
  return (
    <span
      className={`num mono${className ? ` ${className}` : ""}`}
      title={title || undefined}
    >
      {label}
    </span>
  );
}
