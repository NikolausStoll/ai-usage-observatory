/**
 * Human-readable duration from milliseconds for UI display.
 * Stored `durationMs` values are never altered — this is presentation only.
 *
 * Examples: `184 ms`, `1.84 s`, `12.30 s`, `1m 08s`
 */
export function formatDurationMs(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";

  const whole = Math.round(ms);

  if (whole < 1000) {
    return `${whole} ms`;
  }

  if (whole < 60_000) {
    return `${(whole / 1000).toFixed(2)} s`;
  }

  const totalSeconds = Math.floor(whole / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

/** Exact millisecond label for tooltips. */
export function formatDurationPrecise(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "";
  return `${Math.round(ms)} ms`;
}
