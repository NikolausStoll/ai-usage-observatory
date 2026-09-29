import { useEffect, useState, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { fetchEvents } from "../../server-functions/events.js";
import {
  DEFAULT_EVENT_PAGE_SIZE,
  MAX_EVENT_PAGE_SIZE,
  type EventListItem,
  type EventSortBy,
  type EventSortDir,
} from "../../domain/events/event-list.js";
import { EventStatusBadge } from "../../components/EventStatusBadge.js";
import { formatCostCents } from "../../lib/format-cost.js";
import { formatDateTimeDe } from "../../lib/format-date.js";

const PAGE_SIZE_PRESETS = [50, 100, 250, 500, 1000] as const;

const SortBySchema = z.enum([
  "timestamp",
  "status",
  "applicationName",
  "environment",
  "feature",
  "operation",
  "requestedModel",
  "inputTokens",
  "cachedInputTokens",
  "outputTokens",
  "totalCost",
  "durationMs",
]);

const FiltersSchema = z.object({
  applicationId: z.string().optional(),
  status: z.string().optional(),
  environment: z.string().optional(),
  feature: z.string().optional(),
  provider: z.string().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_EVENT_PAGE_SIZE)
    .optional()
    .default(DEFAULT_EVENT_PAGE_SIZE),
  sortBy: SortBySchema.optional().default("timestamp"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});

export const Route = createFileRoute("/events/")({
  validateSearch: FiltersSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchEvents({ data: deps }),
  component: EventsPage,
});

function fmtTokens(v: number | null) {
  return v === null ? <span style={{ color: "#666" }}>—</span> : v.toLocaleString();
}

function ModelCell({ model, provider }: { model: string; provider: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <span ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "#e0e0e0",
          cursor: "pointer",
          font: "inherit",
          textDecoration: "underline dotted",
          textUnderlineOffset: 3,
        }}
        title="Show provider"
      >
        {model}
      </button>
      {open && (
        <span
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            left: 0,
            top: "100%",
            marginTop: 4,
            zIndex: 20,
            background: "#1e1e1e",
            border: "1px solid #444",
            borderRadius: 4,
            padding: "8px 12px",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            fontSize: "0.85em",
          }}
        >
          <span style={{ color: "#888" }}>Provider </span>
          <span style={{ fontFamily: "monospace" }}>{provider}</span>
        </span>
      )}
    </span>
  );
}

function SortHeader({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  column: EventSortBy;
  sortBy: EventSortBy;
  sortDir: EventSortDir;
  onSort: (column: EventSortBy) => void;
}) {
  const active = sortBy === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        color: active ? "#e0e0e0" : "inherit",
        cursor: "pointer",
        font: "inherit",
        textTransform: "inherit",
        fontWeight: "inherit",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      {label}
      <span style={{ opacity: active ? 1 : 0.35, fontSize: "0.9em" }}>
        {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  );
}

function EventsPage() {
  const result = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/events/" });

  const sortBy = (search.sortBy ?? "timestamp") as EventSortBy;
  const sortDir = (search.sortDir ?? "desc") as EventSortDir;

  function setFilter(key: string, value: string) {
    void navigate({
      search: (prev) => ({ ...prev, [key]: value || undefined, page: 1 }),
    });
  }

  function onSort(column: EventSortBy) {
    void navigate({
      search: (prev) => {
        const same = (prev.sortBy ?? "timestamp") === column;
        const nextDir: EventSortDir =
          same && (prev.sortDir ?? "desc") === "desc" ? "asc" : "desc";
        return { ...prev, sortBy: column, sortDir: nextDir, page: 1 };
      },
    });
  }

  const columnHelper = createColumnHelper<EventListItem>();
  const columns = [
    columnHelper.accessor("status", {
      header: () => (
        <SortHeader label="Status" column="status" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => <EventStatusBadge status={info.getValue()} />,
      size: 90,
    }),
    columnHelper.accessor("applicationName", {
      header: () => (
        <SortHeader label="Application" column="applicationName" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
    }),
    columnHelper.accessor("environment", {
      header: () => (
        <SortHeader label="Env" column="environment" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      size: 80,
    }),
    columnHelper.accessor("feature", {
      header: () => (
        <SortHeader label="Feature" column="feature" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
    }),
    columnHelper.accessor("operation", {
      header: () => (
        <SortHeader label="Operation" column="operation" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
    }),
    columnHelper.accessor("requestedModel", {
      header: () => (
        <SortHeader label="Model" column="requestedModel" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => (
        <ModelCell model={info.getValue()} provider={info.row.original.provider} />
      ),
    }),
    columnHelper.accessor("inputTokens", {
      header: () => (
        <SortHeader label="Input tkns" column="inputTokens" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => fmtTokens(info.getValue()),
      size: 90,
    }),
    columnHelper.accessor("cachedInputTokens", {
      header: () => (
        <SortHeader label="Cached tkns" column="cachedInputTokens" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => fmtTokens(info.getValue()),
      size: 95,
    }),
    columnHelper.accessor("outputTokens", {
      header: () => (
        <SortHeader label="Output tkns" column="outputTokens" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => fmtTokens(info.getValue()),
      size: 90,
    }),
    columnHelper.accessor("totalCost", {
      header: () => (
        <SortHeader label="Est. cost (¢)" column="totalCost" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => (
        <span style={{ fontFamily: "monospace", fontSize: "0.9em" }}>
          {formatCostCents(info.getValue())}
        </span>
      ),
      size: 110,
    }),
    columnHelper.accessor("timestamp", {
      header: () => (
        <SortHeader label="Timestamp" column="timestamp" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => (
        <span style={{ fontSize: "0.85em", color: "#aaa" }}>
          {formatDateTimeDe(info.getValue())}
        </span>
      ),
    }),
  ];

  const table = useReactTable({
    data: result.items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    rowCount: result.total,
  });

  const totalPages = Math.ceil(result.total / result.pageSize);

  return (
    <div className="page">
      <h1>Events</h1>

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
            onClick={() =>
              navigate({
                search: {
                  page: 1,
                  pageSize: search.pageSize,
                  sortBy,
                  sortDir,
                },
              })
            }
          >
            Clear filters
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ color: "#888", fontSize: "0.85em" }}>
          {result.total.toLocaleString()} event{result.total !== 1 ? "s" : ""}
          {result.total > result.pageSize && ` — page ${result.page} of ${totalPages}`}
        </div>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center", color: "#888", fontSize: "0.85em" }}>
          Per page
          <select
            value={result.pageSize}
            onChange={(e) =>
              void navigate({
                search: (prev) => ({
                  ...prev,
                  pageSize: Number(e.target.value),
                  page: 1,
                }),
              })
            }
          >
            {!PAGE_SIZE_PRESETS.includes(result.pageSize as (typeof PAGE_SIZE_PRESETS)[number]) && (
              <option value={result.pageSize}>{result.pageSize}</option>
            )}
            {PAGE_SIZE_PRESETS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
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
              <tr
                key={row.id}
                className="clickable-row"
                onClick={() =>
                  void navigate({
                    to: "/events/$eventId",
                    params: { eventId: row.original.eventId },
                  })
                }
              >
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
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
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
