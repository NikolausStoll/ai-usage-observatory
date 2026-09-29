/** Format a USD cost string as cents for display (no rounding of stored values). */
export function formatCostCents(usd: string | null | undefined): string {
  if (usd == null) return "—";
  const n = parseFloat(usd);
  if (isNaN(n)) return usd;
  if (n === 0) return "0.0000 ¢";
  return (n * 100).toFixed(4) + " ¢";
}

/** Precise USD string for tooltips / title attributes (preserves up to 6 dp). */
export function formatCostPrecise(usd: string | null | undefined): string {
  if (usd == null) return "";
  const n = parseFloat(usd);
  if (isNaN(n)) return String(usd);
  return "$" + n.toFixed(6);
}

/**
 * Human-friendly cost label. Precise value stays available via `title`
 * (use formatCostPrecise / the returned title).
 */
export function formatCostDisplay(usd: string | null | undefined): {
  label: string;
  title: string;
} {
  if (usd == null) return { label: "—", title: "" };
  const n = parseFloat(usd);
  if (isNaN(n)) return { label: String(usd), title: String(usd) };
  const title = formatCostPrecise(usd);
  if (n === 0) return { label: "$0", title };
  const abs = Math.abs(n);
  if (abs < 0.01) {
    return { label: `${(n * 100).toFixed(4)} ¢`, title };
  }
  if (abs < 1) {
    return { label: `$${n.toFixed(4)}`, title };
  }
  if (abs < 100) {
    return { label: `$${n.toFixed(2)}`, title };
  }
  return { label: `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, title };
}

/**
 * Human-friendly USD price for catalogue display (e.g. per 1M tokens).
 * Trims storage noise (`$2.0000` → `$2.00`) while keeping genuine
 * fractional precision (`$0.025`). Exact stored value is available via title.
 */
export function formatPriceUsd(usd: string | number | null | undefined): string {
  if (usd == null || usd === "") return "—";
  const raw = typeof usd === "number" ? String(usd) : String(usd);
  const n = typeof usd === "number" ? usd : parseFloat(usd);
  if (isNaN(n)) return raw;
  const [intPart, fracRaw = ""] = n.toFixed(6).split(".");
  let frac = fracRaw.replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `$${intPart}.${frac}`;
}

/** Exact stored price string for tooltips (does not invent trailing zeros). */
export function formatPricePrecise(usd: string | number | null | undefined): string {
  if (usd == null || usd === "") return "";
  const raw = typeof usd === "number" ? String(usd) : String(usd);
  const n = typeof usd === "number" ? usd : parseFloat(usd);
  if (isNaN(n)) return raw;
  return `$${raw}`;
}
