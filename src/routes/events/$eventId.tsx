import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link, useRouter, useRouterState } from "@tanstack/react-router";
import { fetchEvent } from "../../server-functions/events.js";
import { EventStatusBadge } from "../../components/EventStatusBadge.js";
import { TokenUsage } from "../../components/TokenUsage.js";
import { CostBreakdown } from "../../components/CostBreakdown.js";
import { DataQualityHints } from "../../components/DataQualityHints.js";
import { JsonDisplay } from "../../components/JsonDisplay.js";
import { ArtifactViewer } from "../../components/ArtifactViewer.js";
import { CopyableValue } from "../../components/CopyableValue.js";
import { CostDisplay } from "../../components/CostDisplay.js";
import { ModelLabel } from "../../components/ModelLabel.js";
import { SectionHeader } from "../../components/ui/SectionHeader.js";
import { formatDateTimeDe } from "../../lib/format-date.js";
import { formatDurationMs, formatDurationPrecise } from "../../lib/format-duration.js";
import { formatCostDisplay } from "../../lib/format-cost.js";
import type { ArtifactRecord } from "../../domain/artifacts/artifact-schema.js";
import { isArtifactDeleted } from "../../domain/artifacts/artifact-schema.js";

export const Route = createFileRoute("/events/$eventId")({
  loader: ({ params }) => fetchEvent({ data: params.eventId }),
  component: EventDetailPage,
});

function TechRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tech-grid__row">
      <dt className="tech-grid__label">{label}</dt>
      <dd className="tech-grid__value">{children ?? <span className="text-muted">—</span>}</dd>
    </div>
  );
}

function CollapsibleSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <details className="event-collapse section" id={id}>
      <summary className="event-collapse__summary">
        <span className="section-title">{title}</span>
      </summary>
      <div className="event-collapse__body">{children}</div>
    </details>
  );
}

function EventDetailPage() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const hash = useRouterState({ select: (s) => s.location.hash });
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>(data?.artifacts ?? []);

  useEffect(() => {
    setArtifacts(data?.artifacts ?? []);
  }, [data]);

  useEffect(() => {
    if (hash !== "artifacts") return;
    const el = document.getElementById("artifacts");
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hash, artifacts.length]);

  if (!data) {
    return (
      <div className="page">
        <div className="error-box">Event not found</div>
        <Link to="/events" className="back-link">
          ← Back to events
        </Link>
      </div>
    );
  }

  const { event, applicationName } = data;
  const e = event as Record<string, unknown>;

  const subjectLabel =
    typeof e["subject_label"] === "string" && e["subject_label"].trim() !== ""
      ? (e["subject_label"] as string)
      : null;
  const subjectId =
    typeof e["subject_id"] === "string" && e["subject_id"].trim() !== ""
      ? (e["subject_id"] as string)
      : null;

  const feature = e["feature"] as string;
  const operation = e["operation"] as string;
  const environment = e["environment"] as string;
  const status = e["status"] as string;
  const promptId = e["prompt_id"] as string | null;
  const promptVersion = e["prompt_version"] as string | null;
  const durationMs = e["duration_ms"] as number;
  const totalTokens = e["total_tokens"] as number | null;
  const totalCost = e["total_cost"] as string | null;
  const hasUsage = e["input_tokens"] !== null || e["output_tokens"] !== null;
  const isError = status === "error";

  const title =
    subjectLabel ?? ([feature, operation].filter(Boolean).join(" · ") || "Event");
  const promptLine = [promptId, promptVersion != null ? `v${promptVersion}` : null]
    .filter(Boolean)
    .join(" ");
  const costFmt = formatCostDisplay(totalCost);

  const activeArtifacts = artifacts.filter((a) => !isArtifactDeleted(a));
  const inputImageArtifacts = activeArtifacts.filter(
    (a) => a.role === "input" && a.mimeType.startsWith("image/")
  );
  const otherArtifacts = artifacts.filter(
    (a) => !(a.role === "input" && a.mimeType.startsWith("image/") && !isArtifactDeleted(a))
  );
  const otherDeleted = otherArtifacts.filter((a) => isArtifactDeleted(a)).length;
  const hasInputImages = inputImageArtifacts.length > 0;
  const hasRequest =
    e["request_input"] != null || e["request_config"] != null || e["request_raw"] != null;
  const hasResponse =
    e["response_output"] != null || e["response_raw"] != null || e["response_metadata"] != null;

  function handleArtifactDeleted(updated: ArtifactRecord) {
    setArtifacts((prev) =>
      prev.map((a) => (a.artifactId === updated.artifactId ? updated : a))
    );
    void router.invalidate();
  }

  return (
    <div className="page page--wide event-detail">
      <div className="detail-bar">
        <Link to="/events" className="back-link">
          ← Events
        </Link>
      </div>

      {/* ── Hero / summary ─────────────────────────────────────── */}
      <header className="event-hero">
        <div className="event-hero__title-row">
          <h1 className="event-hero__title">{title}</h1>
          <EventStatusBadge status={status} />
        </div>

        {subjectId ? (
          <div className="event-hero__subject-id mono text-sm text-muted">{subjectId}</div>
        ) : null}

        <div className="event-hero__context">
          <span>
            {applicationName}
            <span className="text-muted"> · </span>
            {environment}
          </span>
          {subjectLabel ? (
            <span>
              {feature}
              <span className="text-muted"> · </span>
              {operation}
            </span>
          ) : null}
        </div>

        <div className="event-hero__model">
          <ModelLabel
            model={e["requested_model"] as string}
            provider={e["provider"] as string}
          />
          {promptLine ? (
            <>
              <span className="text-muted"> · </span>
              <span className="mono text-secondary">{promptLine}</span>
            </>
          ) : null}
        </div>

        <div className="event-hero__metrics" aria-label="Key metrics">
          <div className="event-hero__metric">
            <div
              className="event-hero__metric-value num"
              title={formatDurationPrecise(durationMs)}
            >
              {formatDurationMs(durationMs)}
            </div>
            <div className="event-hero__metric-label">Duration</div>
          </div>
          <div className="event-hero__metric">
            <div className="event-hero__metric-value num mono">
              {totalTokens != null ? totalTokens.toLocaleString() : "—"}
            </div>
            <div className="event-hero__metric-label">Tokens</div>
          </div>
          <div className="event-hero__metric">
            <div className="event-hero__metric-value num mono" title={costFmt.title || undefined}>
              <CostDisplay usd={totalCost} />
            </div>
            <div className="event-hero__metric-label">Cost</div>
          </div>
        </div>
      </header>

      {/* ── Error (prominent) ──────────────────────────────────── */}
      {isError ? (
        <div className="event-error alert alert--danger" role="alert">
          <div className="event-error__head">
            <strong>{(e["error_type"] as string | null) ?? "Error"}</strong>
            {e["http_status"] != null ? (
              <span className="badge badge--danger">HTTP {String(e["http_status"])}</span>
            ) : null}
          </div>
          {e["error_message"] != null ? (
            <p className="event-error__message">{e["error_message"] as string}</p>
          ) : null}
          {e["error_metadata"] != null ? (
            <div className="event-error__meta">
              <JsonDisplay value={e["error_metadata"]} label="Error metadata" secondary />
            </div>
          ) : null}
        </div>
      ) : null}

      <DataQualityHints event={e} />

      {/* ── Compact token + cost breakdowns ────────────────────── */}
      <div className="event-breakdowns">
        <div className="event-breakdowns__panel">
          <SectionHeader title="Tokens" />
          <TokenUsage
            inputTokens={e["input_tokens"] as number | null}
            cachedInputTokens={e["cached_input_tokens"] as number | null}
            outputTokens={e["output_tokens"] as number | null}
            reasoningTokens={e["reasoning_tokens"] as number | null}
            totalTokens={totalTokens}
          />
        </div>
        <div className="event-breakdowns__panel">
          <SectionHeader title="Cost" />
          <CostBreakdown
            inputCost={e["input_cost"] as string | null}
            cachedInputCost={e["cached_input_cost"] as string | null}
            outputCost={e["output_cost"] as string | null}
            totalCost={totalCost}
            pricingId={e["pricing_id"] as string | null}
            hasUsage={hasUsage}
            hidePricingState
          />
        </div>
      </div>

      {/* ── Request / Response inspector (+ vision artifacts) ─── */}
      <div
        className={`event-inspector${hasInputImages ? " event-inspector--vision" : ""}`}
      >
        <section className="event-inspector__col">
          <SectionHeader
            title={hasInputImages ? "Request & source" : "Request"}
          />
          {hasInputImages ? (
            <div className="event-artifacts-inline" id="artifacts">
              {inputImageArtifacts.map((a) => (
                <ArtifactViewer
                  key={a.artifactId}
                  artifact={a}
                  size="large"
                  onDeleted={handleArtifactDeleted}
                />
              ))}
            </div>
          ) : null}
          <div className="stack">
            {e["request_input"] != null ? (
              <JsonDisplay value={e["request_input"]} label="Input" />
            ) : (
              <span className="text-muted text-sm">No input stored</span>
            )}
            {e["request_config"] != null ? (
              <JsonDisplay value={e["request_config"]} label="Config" secondary />
            ) : null}
            {e["request_metadata"] != null ? (
              <JsonDisplay value={e["request_metadata"]} label="Metadata" secondary />
            ) : null}
            {e["request_raw"] != null ? (
              <JsonDisplay value={e["request_raw"]} label="Raw" secondary />
            ) : null}
            {!hasRequest && !hasInputImages ? (
              <span className="text-muted">No request data</span>
            ) : null}
          </div>
        </section>

        <section className="event-inspector__col">
          <SectionHeader title="Response" />
          <div className="stack">
            {e["response_output"] != null ? (
              <JsonDisplay value={e["response_output"]} label="Output" />
            ) : (
              <span className="text-muted text-sm">No output stored</span>
            )}
            {e["response_metadata"] != null ? (
              <JsonDisplay value={e["response_metadata"]} label="Metadata" secondary />
            ) : null}
            {e["response_raw"] != null ? (
              <JsonDisplay value={e["response_raw"]} label="Raw" secondary />
            ) : null}
            {!hasResponse ? <span className="text-muted">No response data</span> : null}
          </div>
        </section>
      </div>

      {/* ── Remaining artifacts ────────────────────────────────── */}
      {otherArtifacts.length > 0 ? (
        <section className="section" id={hasInputImages ? undefined : "artifacts"}>
          <SectionHeader
            title={
              otherDeleted > 0
                ? `Other artifacts (${otherArtifacts.length} · ${otherDeleted} deleted)`
                : `Other artifacts (${otherArtifacts.length})`
            }
          />
          <div className="stack">
            {otherArtifacts.map((a) => (
              <ArtifactViewer
                key={a.artifactId}
                artifact={a}
                onDeleted={handleArtifactDeleted}
              />
            ))}
          </div>
        </section>
      ) : inputImageArtifacts.length === 0 && artifacts.length === 0 ? (
        <section className="section" id="artifacts">
          <SectionHeader title="Artifacts" />
          <span className="text-muted">No artifacts</span>
        </section>
      ) : null}

      {/* ── App data ───────────────────────────────────────────── */}
      {(e["metadata"] != null || e["metrics"] != null || e["raw_usage"] != null) && (
        <CollapsibleSection title="App data & raw usage">
          <div className="stack">
            {e["metadata"] != null && (
              <JsonDisplay value={e["metadata"]} label="Event metadata" secondary />
            )}
            {e["metrics"] != null && (
              <JsonDisplay value={e["metrics"]} label="Custom metrics" secondary />
            )}
            {e["raw_usage"] != null && (
              <JsonDisplay value={e["raw_usage"]} label="Raw usage" secondary />
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* ── Technical details ──────────────────────────────────── */}
      <CollapsibleSection title="Technical details">
        <dl className="tech-grid">
          <TechRow label="Event ID">
            <CopyableValue value={e["event_id"] as string} />
          </TechRow>
          {subjectId ? (
            <TechRow label="Subject ID">
              <CopyableValue value={subjectId} />
            </TechRow>
          ) : null}
          {subjectLabel ? (
            <TechRow label="Subject label">
              <span>{subjectLabel}</span>
            </TechRow>
          ) : null}
          <TechRow label="Application">
            <span>
              {applicationName}{" "}
              <span className="text-muted">(</span>
              <CopyableValue value={e["application_id"] as string} />
              <span className="text-muted">)</span>
            </span>
          </TechRow>
          <TechRow label="App version">
            {(e["application_version"] as string | null) ?? (
              <span className="text-muted">—</span>
            )}
          </TechRow>
          <TechRow label="Environment">{environment}</TechRow>
          <TechRow label="Feature">{feature}</TechRow>
          <TechRow label="Operation">{operation}</TechRow>
          <TechRow label="Operation ID">
            <CopyableValue value={e["operation_id"] as string} />
          </TechRow>
          <TechRow label="Workflow ID">
            {e["workflow_id"] != null ? (
              <CopyableValue value={e["workflow_id"] as string} />
            ) : (
              <span className="text-muted">—</span>
            )}
          </TechRow>
          <TechRow label="Attempt #">
            <span className="num">{e["attempt_number"] as number}</span>
          </TechRow>
          <TechRow label="Provider">{e["provider"] as string}</TechRow>
          <TechRow label="Requested model">
            <span className="mono">{e["requested_model"] as string}</span>
          </TechRow>
          <TechRow label="Reported model">
            {e["reported_model"] != null ? (
              <span className="mono">{e["reported_model"] as string}</span>
            ) : (
              <span className="text-muted">—</span>
            )}
          </TechRow>
          <TechRow label="Prompt ID">
            {promptId ? <CopyableValue value={promptId} /> : <span className="text-muted">—</span>}
          </TechRow>
          <TechRow label="Prompt version">
            {promptVersion ?? <span className="text-muted">—</span>}
          </TechRow>
          <TechRow label="Timestamp">
            <span className="num">{formatDateTimeDe(e["timestamp"] as string)}</span>
          </TechRow>
          <TechRow label="Received at">
            <span className="num">{formatDateTimeDe(e["received_at"] as string)}</span>
          </TechRow>
          <TechRow label="Duration">
            <span className="num" title={formatDurationPrecise(durationMs)}>
              {formatDurationMs(durationMs)}
            </span>
          </TechRow>
          <TechRow label="Pricing ID">
            {e["pricing_id"] != null ? (
              <CopyableValue value={e["pricing_id"] as string} />
            ) : (
              <span className="text-muted">—</span>
            )}
          </TechRow>
        </dl>
      </CollapsibleSection>
    </div>
  );
}
