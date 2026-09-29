import { Link } from "@tanstack/react-router";
import { EventStatusBadge } from "./EventStatusBadge.js";
import { CostDisplay } from "./CostDisplay.js";
import { ModelLabel } from "./ModelLabel.js";
import { formatDateTimeDe, formatDateTimeShortDe } from "../lib/format-date.js";
import { formatDurationMs, formatDurationPrecise } from "../lib/format-duration.js";

export interface EventListCardData {
  eventId: string;
  status: string;
  provider: string;
  requestedModel: string;
  feature?: string | null;
  operation?: string | null;
  applicationName: string;
  environment?: string | null;
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  totalCost: string | null;
  timestamp: string;
  /** Optional — omitted on compact dashboard recent events. */
  durationMs?: number | null;
}

function fmtTok(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

/** Mobile / compact event list item — navigates to event detail. */
export function EventListCard({ event }: { event: EventListCardData }) {
  const hasTokens =
    event.inputTokens != null ||
    event.cachedInputTokens != null ||
    event.outputTokens != null;

  const featureOp = [event.feature, event.operation].filter(Boolean).join(" · ");
  const appEnv = [event.applicationName, event.environment].filter(Boolean).join(" · ");
  const durationLabel =
    event.durationMs != null ? formatDurationMs(event.durationMs) : null;
  const durationTitle =
    event.durationMs != null ? formatDurationPrecise(event.durationMs) : "";

  return (
    <Link
      to="/events/$eventId"
      params={{ eventId: event.eventId }}
      className="event-card"
    >
      <div className="event-card__top">
        <EventStatusBadge status={event.status} />
        <ModelLabel model={event.requestedModel} provider={event.provider} />
      </div>

      {featureOp ? (
        <div className="event-card__primary">{featureOp}</div>
      ) : null}

      {appEnv ? (
        <div className="event-card__meta">{appEnv}</div>
      ) : null}

      <div className="event-card__metrics">
        {hasTokens ? (
          <div
            className="event-card__tokens num"
            title="Input · Cached · Output"
          >
            <span>{fmtTok(event.inputTokens)} in</span>
            <span className="event-card__sep">·</span>
            <span>{fmtTok(event.cachedInputTokens)} cached</span>
            <span className="event-card__sep">·</span>
            <span>{fmtTok(event.outputTokens)} out</span>
          </div>
        ) : (
          <span className="text-muted text-sm">No tokens</span>
        )}
        <CostDisplay usd={event.totalCost} className="event-card__cost" />
      </div>

      <div className="event-card__foot">
        {durationLabel ? (
          <>
            <span className="event-card__duration num" title={durationTitle}>
              {durationLabel}
            </span>
            <span className="event-card__sep" aria-hidden>
              ·
            </span>
          </>
        ) : null}
        <span
          className="event-card__time"
          title={formatDateTimeDe(event.timestamp)}
        >
          {formatDateTimeShortDe(event.timestamp)}
        </span>
      </div>
    </Link>
  );
}
