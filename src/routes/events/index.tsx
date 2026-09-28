import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { fetchEvents } from "../../server-functions/events.js";
import type { EventListItem } from "../../domain/events/event-service.js";
import { EventStatusBadge } from "../../components/EventStatusBadge.js";

const FiltersSchema = z.object({
  applicationId: z.string().optional(),
  status: z.string().optional(),
  environment: z.string().optional(),
  feature: z.string().optional(),
  provider: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
});

export const Route = createFileRoute("/events/")({
  validateSearch: FiltersSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchEvents({ data: deps }),
  component: EventsPage,
});

const columnHelper = createColumnHelper<EventListItem>();
const columns = [
  columnHelper.accessor("status", {
    header: "Status",
    cell: (info) => <EventStatusBadge status={info.getValue()} />,
    size: 90,
  }),
  columnHelper.accessor("applicationName", { header: "Application" }),
  columnHelper.accessor("environment", { header: "Env", size: 80 }),
  columnHelper.accessor("feature", { header: "Feature" }),
  columnHelper.accessor("operation", { header: "Operation" }),
  columnHelper.accessor("provider", { header: "Provider", size: 80 }),
  columnHelper.accessor("requestedModel", { header: "Model" }),
  columnHelper.accessor("inputTokens", {
    header: "Input tkns",
    cell: (info) => {
      const v = info.getValue();
      return v === null ? <span style={{ color: "#666" }}>—</span> : v.toLocaleString();
    },
    size: 90,
  }),
  columnHelper.accessor("outputTokens", {
    header: "Output tkns",
    cell: (info) => {
      const v = info.getValue();
      return v === null ? <span style={{ color: "#666" }}>—</span> : v.toLocaleString();
    },
    size: 90,
  }),
  columnHelper.accessor("totalCost", {
    header: "Est. cost",
    cell: (info) => {
      const v = info.getValue();
      if (v === null) return <span style={{ color: "#666" }}>—</span>;
      const n = parseFloat(v);
      return <span style={{ fontFamily: "monospace", fontSize: "0.9em" }}>${n.toFixed(6)}</span>;
    },
    size: 100,
  }),
  columnHelper.accessor("timestamp", {
    header: "Timestamp",
    cell: (info) => (
      <span style={{ fontSize: "0.85em", color: "#aaa" }}>
        {new Date(info.getValue()).toLocaleString()}
      </span>
    ),
  }),
  columnHelper.display({
    id: "actions",
    cell: (info) => (
      <Link
        to="/events/$eventId"
        params={{ eventId: info.row.original.eventId }}
        style={{ fontSize: "0.8em" }}
      >
        View →
      </Link>
    ),
    size: 60,
  }),
];

function EventsPage() {
  const result = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });

  const table = useReactTable({
    data: result.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    rowCount: result.total,
  });

  function setFilter(key: string, value: string) {
    void navigate({
      search: (prev) => ({ ...prev, [key]: value || undefined, page: 1 }),
    });
  }

  const totalPages = Math.ceil(result.total / result.pageSize);

  return (
    <div className="page">
      <h1>Events</h1>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <input
          placeholder="Application ID"
          value={search.applicationId ?? ""}
          onChange={(e) => setFilter("applicationId", e.target.value)}
          style={{ width: 160 }}
        />
        <select
          value={search.status ?? ""}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
        <input
          placeholder="Environment"
          value={search.environment ?? ""}
          onChange={(e) => setFilter("environment", e.target.value)}
          style={{ width: 130 }}
        />
        <input
          placeholder="Feature"
          value={search.feature ?? ""}
          onChange={(e) => setFilter("feature", e.target.value)}
          style={{ width: 130 }}
        />
        <input
          placeholder="Provider"
          value={search.provider ?? ""}
          onChange={(e) => setFilter("provider", e.target.value)}
          style={{ width: 120 }}
        />
        {(search.applicationId || search.status || search.environment || search.feature || search.provider) && (
          <button
            className="btn"
            onClick={() => navigate({ search: { page: 1 } })}
          >
            Clear filters
          </button>
        )}
      </div>

      <div style={{ color: "#888", fontSize: "0.85em", marginBottom: 8 }}>
        {result.total.toLocaleString()} event{result.total !== 1 ? "s" : ""}
        {result.total > result.pageSize && ` — page ${result.page} of ${totalPages}`}
      </div>

      <table>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ color: "#666", textAlign: "center", padding: 32 }}>
                No events found
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16 }}>
          <button
            className="btn"
            disabled={result.page <= 1}
            onClick={() => navigate({ search: (prev) => ({ ...prev, page: result.page - 1 }) })}
          >
            ← Prev
          </button>
          <span style={{ color: "#888", fontSize: "0.9em" }}>
            Page {result.page} / {totalPages}
          </span>
          <button
            className="btn"
            disabled={result.page >= totalPages}
            onClick={() => navigate({ search: (prev) => ({ ...prev, page: result.page + 1 }) })}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
