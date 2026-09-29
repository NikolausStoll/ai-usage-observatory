import { useNavigate } from "@tanstack/react-router";
import { EventStatusBadge } from "./EventStatusBadge.js";
import { CostDisplay } from "./CostDisplay.js";
import { ModelLabel } from "./ModelLabel.js";
import { formatArtifactHint } from "./ArtifactHint.js";
import { formatDateTimeDe, formatDateTimeShortDe } from "../lib/format-date.js";
import { formatDurationMs, formatDurationPrecise } from "../lib/format-duration.js";

export interface EventListCardData {
  eventId: string;
  status: string;
  provider: string;
  requestedModel: string;
  feature?: string | null;
  operation?: string | null;
  subjectId?: string | null;
  subjectLabel?: string | null;
  applicationName: string;
  environment?: string | null;
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  totalCost: string | null;
  timestamp: string;
  /** Optional — omitted on compact dashboard recent events. */
  durationMs?: number | null;
  artifactCount?: number;
  artifactDeletedCount?: number;
}

function fmtTok(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString();
}

/** Mobile / compact event list item — navigates to event detail. */
export function EventListCard({ event }: { event: EventListCardData }) {
  const navigate = useNavigate();
  const hasTokens =
    event.inputTokens != null ||
    event.cachedInputTokens != null ||
    event.outputTokens != null;

  const subjectLabel =
    event.subjectLabel != null && event.subjectLabel.trim() !== ""
      ? event.subjectLabel
      : null;
  const subjectId =
    event.subjectId != null && event.subjectId.trim() !== ""
      ? event.subjectId
      : null;
  const featureOp = [event.feature, event.operation].filter(Boolean).join(" · ");
  const appEnv = [event.applicationName, event.environment].filter(Boolean).join(" · ");
  const durationLabel =
    event.durationMs != null ? formatDurationMs(event.durationMs) : null;
  const durationTitle =
    event.durationMs != null ? formatDurationPrecise(event.durationMs) : "";
  const artifactHint = formatArtifactHint(
    event.artifactCount ?? 0,
    event.artifactDeletedCount ?? 0
  );

  function openDetail(hash?: string) {
    void navigate({
      to: "/events/$eventId",
      params: { eventId: event.eventId },
      hash,
    });
  }

  return (
    <div
      className="event-card"
      role="link"
      tabIndex={0}
      onClick={() => openDetail()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openDetail();
        }
      }}
    >
      <div className="event-card__top">
        <EventStatusBadge status={event.status} />
        <ModelLabel model={event.requestedModel} provider={event.provider} />
      </div>

      {subjectLabel || subjectId ? (
        <>
          <div className="event-card__primary">
            {subjectLabel ?? <span className="text-muted">—</span>}
          </div>
          {subjectId ? (
            <div className="event-card__meta mono">{subjectId}</div>
          ) : null}
        </>
      ) : null}

      {featureOp ? (
        <div
          className={
            subjectLabel || subjectId ? "event-card__meta" : "event-card__primary"
          }
        >
          {featureOp}
        </div>
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
        {artifactHint ? (
          <>
            <button
              type="button"
              className={`event-card__artifacts${artifactHint.allDeleted ? " event-card__artifacts--deleted" : ""}`}
              title={artifactHint.title}
              onClick={(e) => {
                e.stopPropagation();
                openDetail("artifacts");
              }}
            >
              {artifactHint.label}
            </button>
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
    </div>
  );
}
