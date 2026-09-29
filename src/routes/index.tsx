import { createFileRoute, Link } from "@tanstack/react-router";
import { fetchDashboardStats } from "../server-functions/dashboard.js";
import type { DashboardStats } from "../domain/dashboard/dashboard-service.js";
import { formatDateTimeDe } from "../lib/format-date.js";

export const Route = createFileRoute("/")({
  loader: () => fetchDashboardStats(),
  component: DashboardPage,
});

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function DashboardPage() {
  const stats: DashboardStats = Route.useLoaderData();

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 32 }}>
        <StatCard value={stats.totalEvents.toLocaleString()} label="Total events" />
        <StatCard value={stats.successEvents.toLocaleString()} label="Success" />
        <StatCard value={stats.errorEvents.toLocaleString()} label="Errors" />
        <StatCard value={stats.totalInputTokens.toLocaleString()} label="Input tokens" />
        <StatCard value={stats.totalOutputTokens.toLocaleString()} label="Output tokens" />
        <StatCard value={`$${parseFloat(stats.totalCost).toFixed(4)}`} label="Estimated cost" />
        <StatCard value={stats.missingPricingModels} label="Models missing pricing" />
      </div>

      {stats.missingPricingModels > 0 && (
        <div className="card" style={{ borderColor: "#ff9800", background: "#1a1200" }}>
          <span className="text-warn">⚠ {stats.missingPricingModels} provider/model combination{stats.missingPricingModels > 1 ? "s" : ""} have no pricing configured. </span>
          <Link to="/pricing">Manage pricing →</Link>
        </div>
      )}

      <div className="section">
        <h2>Recent events</h2>
        {stats.recentEvents.length === 0 ? (
          <div className="text-muted">No events yet. <Link to="/applications">Create an application</Link> to start ingesting.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Application</th>
                <th>Provider / Model</th>
                <th>Cost</th>
                <th>Timestamp</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {stats.recentEvents.map((e) => (
                <tr key={e.eventId}>
                  <td>
                    <span style={{
                      color: e.status === "success" ? "#4caf50" : "#f44336",
                      fontWeight: "bold",
                      fontSize: "0.85em",
                    }}>{e.status}</span>
                  </td>
                  <td>{e.applicationName}</td>
                  <td className="mono" style={{ fontSize: "0.85em" }}>{e.provider}/{e.requestedModel}</td>
                  <td className="mono" style={{ fontSize: "0.85em" }}>
                    {e.totalCost ? `$${parseFloat(e.totalCost).toFixed(6)}` : <span className="text-muted">—</span>}
                  </td>
                  <td style={{ fontSize: "0.85em", color: "#888" }}>{formatDateTimeDe(e.timestamp)}</td>
                  <td>
                    <Link to="/events/$eventId" params={{ eventId: e.eventId }} style={{ fontSize: "0.8em" }}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {stats.totalEvents > 10 && (
          <div style={{ marginTop: 12 }}>
            <Link to="/events">View all {stats.totalEvents.toLocaleString()} events →</Link>
          </div>
        )}
      </div>
    </div>
  );
}
