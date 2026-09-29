const DATE_OPTS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

const DATETIME_OPTS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTS,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
};

const DATETIME_SHORT_OPTS: Intl.DateTimeFormatOptions = {
  ...DATE_OPTS,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

/** German date, e.g. 29.09.2026 */
export function formatDateDe(iso: string | null | undefined): string {
  if (iso == null) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", DATE_OPTS);
}

/** German date+time (24h), e.g. 29.09.2026, 14:30:00 */
export function formatDateTimeDe(iso: string | null | undefined): string {
  if (iso == null) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", DATETIME_OPTS);
}

/** Compact German date+time without seconds, e.g. 29.09.2026, 14:30 */
export function formatDateTimeShortDe(iso: string | null | undefined): string {
  if (iso == null) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", DATETIME_SHORT_OPTS);
}
