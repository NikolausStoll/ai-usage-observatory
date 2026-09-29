import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchEvent } from "../../server-functions/events.js";
import { EventStatusBadge } from "../../components/EventStatusBadge.js";
import { TokenUsage } from "../../components/TokenUsage.js";
import { CostBreakdown } from "../../components/CostBreakdown.js";
import { DataQualityHints } from "../../components/DataQualityHints.js";
import { JsonDisplay } from "../../components/JsonDisplay.js";
import { ArtifactViewer } from "../../components/ArtifactViewer.js";
import { SectionHeader } from "../../components/ui/SectionHeader.js";
import { formatDateTimeDe } from "../../lib/format-date.js";

export const Route = createFileRoute("/events/$eventId")({
  loader: ({ params }) => fetchEvent({ data: params.eventId }),
  component: EventDetailPage,
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  const isString = typeof value === "string";
  return (
    <tr>
      <td>{label}</td>
      <td className={isString ? "mono" : undefined}>
        {value ?? <span className="text-muted">—</span>}
      </td>
    </tr>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="section">
      <SectionHeader title={title} />
      <div className="card">{children}</div>
    </div>
  );
}

function EventDetailPage() {
  const data = Route.useLoaderData();

  if (!data) {
    return (
      <div className="page">
        <div className="error-box">Event not found</div>
        <Link to="/events" className="back-link">← Back to events</Link>
      </div>
    );
  }

  const { event, artifacts } = data;
  const e = event as Record<string, unknown>;

  const hasUsage = e["input_tokens"] !== null || e["output_tokens"] !== null;

  return (
    <div className="page">
      <div className="detail-bar">
        <Link to="/events" className="back-link">← Events</Link>
        <EventStatusBadge status={e["status"] as string} />
        <span className="mono text-sm text-secondary">
          {e["event_id"] as string}
        </span>
      </div>

      <DataQualityHints event={e} />
      {hasUsage && <div style={{ marginBottom: "var(--space-4)" }} />}

      <Section title="Identity">
        <table className="meta-table">
          <tbody>
            <Row label="Application" value={e["application_id"] as string} />
            <Row label="App version" value={e["application_version"] as string | null} />
            <Row label="Environment" value={e["environment"] as string} />
            <Row label="Feature" value={e["feature"] as string} />
            <Row label="Operation" value={e["operation"] as string} />
            <Row label="Operation ID" value={e["operation_id"] as string} />
            <Row label="Workflow ID" value={e["workflow_id"] as string | null} />
            <Row label="Attempt #" value={e["attempt_number"] as number} />
          </tbody>
        </table>
      </Section>

      <Section title="Timing">
        <table className="meta-table">
          <tbody>
            <Row label="Timestamp" value={formatDateTimeDe(e["timestamp"] as string)} />
            <Row label="Duration" value={<span className="num">{`${(e["duration_ms"] as number).toLocaleString("de-DE")} ms`}</span>} />
            <Row label="Received at" value={formatDateTimeDe(e["received_at"] as string)} />
          </tbody>
        </table>
      </Section>

      <Section title="Provider">
        <table className="meta-table">
          <tbody>
            <Row label="Provider" value={e["provider"] as string} />
            <Row label="Requested model" value={e["requested_model"] as string} />
            <Row label="Reported model" value={e["reported_model"] as string | null} />
            <Row label="Prompt ID" value={e["prompt_id"] as string | null} />
            <Row label="Prompt version" value={e["prompt_version"] as string | null} />
          </tbody>
        </table>
      </Section>

      {e["status"] === "error" && (
        <Section title="Error">
          <table className="meta-table">
            <tbody>
              <Row label="HTTP status" value={e["http_status"] as number | null} />
              <Row label="Error type" value={e["error_type"] as string | null} />
              <Row label="Error message" value={e["error_message"] as string | null} />
            </tbody>
          </table>
          {e["error_metadata"] != null && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <JsonDisplay value={e["error_metadata"]} label="Error metadata" />
            </div>
          )}
        </Section>
      )}

      <Section title="Token Usage">
        <TokenUsage
          inputTokens={e["input_tokens"] as number | null}
          cachedInputTokens={e["cached_input_tokens"] as number | null}
          outputTokens={e["output_tokens"] as number | null}
          reasoningTokens={e["reasoning_tokens"] as number | null}
          totalTokens={e["total_tokens"] as number | null}
        />
        {e["raw_usage"] != null && (
          <div style={{ marginTop: "var(--space-3)" }}>
            <JsonDisplay value={e["raw_usage"]} label="Raw usage" />
          </div>
        )}
      </Section>

      <Section title="Cost">
        <CostBreakdown
          inputCost={e["input_cost"] as string | null}
          cachedInputCost={e["cached_input_cost"] as string | null}
          outputCost={e["output_cost"] as string | null}
          totalCost={e["total_cost"] as string | null}
          pricingId={e["pricing_id"] as string | null}
          hasUsage={hasUsage}
        />
      </Section>

      <Section title="Request">
        <div className="stack">
          {e["request_config"] != null && <JsonDisplay value={e["request_config"]} label="Config" />}
          {e["request_input"] != null
            ? <JsonDisplay value={e["request_input"]} label="Input" />
            : <span className="text-muted">No input stored</span>}
          {e["request_raw"] != null && <JsonDisplay value={e["request_raw"]} label="Raw" />}
          {e["request_metadata"] != null && <JsonDisplay value={e["request_metadata"]} label="Metadata" />}
        </div>
      </Section>

      <Section title="Response">
        <div className="stack">
          {e["response_output"] != null
            ? <JsonDisplay value={e["response_output"]} label="Output" />
            : <span className="text-muted">No output stored</span>}
          {e["response_raw"] != null && <JsonDisplay value={e["response_raw"]} label="Raw" />}
          {e["response_metadata"] != null && <JsonDisplay value={e["response_metadata"]} label="Metadata" />}
        </div>
      </Section>

      {(e["metadata"] != null || e["metrics"] != null) && (
        <Section title="App data">
          <div className="stack">
            {e["metadata"] != null && <JsonDisplay value={e["metadata"]} label="Metadata" />}
            {e["metrics"] != null && <JsonDisplay value={e["metrics"]} label="Metrics" />}
          </div>
        </Section>
      )}

      <Section title={`Artifacts (${artifacts.length})`}>
        {artifacts.length === 0 ? (
          <span className="text-muted">No artifacts</span>
        ) : (
          artifacts.map((a) => <ArtifactViewer key={a.artifactId} artifact={a} />)
        )}
      </Section>
    </div>
  );
}
