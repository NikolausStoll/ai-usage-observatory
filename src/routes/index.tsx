import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { fetchDashboardStats } from "../server-functions/dashboard.js";
import type { DashboardStats } from "../domain/dashboard/dashboard-service.js";
import { formatDateTimeDe, formatDateTimeShortDe } from "../lib/format-date.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { EventStatusBadge } from "../components/EventStatusBadge.js";
import { EventListCard } from "../components/EventListCard.js";
import { CostDisplay } from "../components/CostDisplay.js";
import { ModelLabel } from "../components/ModelLabel.js";
import { formatCostDisplay } from "../lib/format-cost.js";

export const Route = createFileRoute("/")({
  loader: () => fetchDashboardStats(),
  component: DashboardPage,
});

function DashboardPage() {
  const stats: DashboardStats = Route.useLoaderData();
  const navigate = useNavigate();
  const cost = formatCostDisplay(stats.totalCost);

  return (
    <div className="page">
      <PageHeader title="Dashboard" />

      <div className="overview">
        <div className="overview__metric overview__metric--primary">
          <div className="overview__value num">{stats.totalEvents.toLocaleString()}</div>
          <div className="overview__label">Events</div>
        </div>

        <div className="overview__metric overview__metric--primary">
          <div className="overview__value num" title={cost.title}>{cost.label}</div>
          <div className="overview__label">Est. cost</div>
        </div>

        <div className="overview__metric">
          <div className="overview__label" style={{ marginTop: 0, marginBottom: 4 }}>
            Tokens
          </div>
          <div className="overview__sub overview__sub--inline">
            <span className="overview__sub-inline num">
              <strong>{stats.totalInputTokens.toLocaleString()}</strong>
              <span className="text-muted"> in</span>
            </span>
            <span className="overview__sub-sep">·</span>
            <span className="overview__sub-inline num">
              <strong>{stats.totalOutputTokens.toLocaleString()}</strong>
              <span className="text-muted"> out</span>
            </span>
          </div>
        </div>

        <div className="overview__metric overview__outcome">
          <div className="overview__label" style={{ marginTop: 0, marginBottom: 4 }}>
            Health
          </div>
          <div className="overview__health num">
            <span className="text-success">{stats.successEvents.toLocaleString()} ok</span>
            <span className="overview__sub-sep">·</span>
            <span className="text-error">{stats.errorEvents.toLocaleString()} err</span>
          </div>
        </div>
      </div>

      {stats.missingPricingModels > 0 && (
        <div className="alert alert--warning" style={{ marginBottom: "var(--space-5)" }}>
          <span className="text-warn">
            ⚠ {stats.missingPricingModels} provider/model combination
            {stats.missingPricingModels > 1 ? "s" : ""} have no pricing configured.{" "}
          </span>
          <Link to="/pricing">Manage pricing →</Link>
        </div>
      )}

      <div className="section">
        <div className="section-header">
          <h2 className="section-title">Recent events</h2>
          {stats.totalEvents > 10 && (
            <Link to="/events" className="text-sm">
              View all {stats.totalEvents.toLocaleString()} →
            </Link>
          )}
        </div>

        {stats.recentEvents.length === 0 ? (
          <EmptyState inline>
            No events yet. <Link to="/applications">Create an application</Link> to start ingesting.
          </EmptyState>
        ) : (
          <>
            <div className="events-desktop table-wrap">
              <table className="events-table">
                <thead>
                  <tr>
                    <th className="col-status">Status</th>
                    <th>Application</th>
                    <th>Model</th>
                    <th className="num-col col-cost">Cost</th>
                    <th className="col-time">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentEvents.map((e) => (
                    <tr
                      key={e.eventId}
                      className="clickable-row"
                      onClick={() =>
                        void navigate({
                          to: "/events/$eventId",
                          params: { eventId: e.eventId },
                        })
                      }
                    >
                      <td><EventStatusBadge status={e.status} /></td>
                      <td>
                        <div>{e.applicationName}</div>
                        <div className="text-muted text-sm">{e.environment} · {e.feature}</div>
                      </td>
                      <td>
                        <ModelLabel model={e.requestedModel} provider={e.provider} />
                      </td>
                      <td className="num-col">
                        <CostDisplay usd={e.totalCost} className="text-sm" />
                      </td>
                      <td className="col-time text-muted" title={formatDateTimeDe(e.timestamp)}>
                        {formatDateTimeShortDe(e.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="events-mobile">
              {stats.recentEvents.map((e) => (
                <EventListCard key={e.eventId} event={e} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
