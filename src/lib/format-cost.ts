/** Format a USD cost string as cents for display (no rounding of stored values). */
export function formatCostCents(usd: string | null | undefined): string {
  if (usd == null) return "—";
  const n = parseFloat(usd);
  if (isNaN(n)) return usd;
  if (n === 0) return "0.0000 ¢";
  return (n * 100).toFixed(4) + " ¢";
}
