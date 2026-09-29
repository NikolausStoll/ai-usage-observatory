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
import { EventListCard } from "../../components/EventListCard.js";
import { CostDisplay } from "../../components/CostDisplay.js";
import { ModelLabel } from "../../components/ModelLabel.js";
import { PageHeader } from "../../components/ui/PageHeader.js";
import { formatDateTimeDe, formatDateTimeShortDe } from "../../lib/format-date.js";

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
  return v === null ? <span className="text-muted">—</span> : <span className="num">{v.toLocaleString()}</span>;
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
      className={`sort-btn${active ? " sort-btn--active" : ""}`}
      onClick={() => onSort(column)}
    >
      {label}
      <span style={{ opacity: active ? 1 : 0.35, fontSize: "0.9em" }} aria-hidden>
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

  const hasFilters = Boolean(
    search.applicationId || search.status || search.environment || search.feature || search.provider
  );

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

  function clearFilters() {
    void navigate({
      search: {
        page: 1,
        pageSize: search.pageSize,
        sortBy,
        sortDir,
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
      size: 72,
    }),
    columnHelper.accessor("applicationName", {
      header: () => (
        <SortHeader label="Application" column="applicationName" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => (
        <div>
          <div>{info.getValue()}</div>
          <div className="text-muted text-sm">{info.row.original.environment}</div>
        </div>
      ),
    }),
    columnHelper.accessor("feature", {
      header: () => (
        <SortHeader label="Feature / Op" column="feature" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => (
        <div>
          <div>{info.getValue()}</div>
          <div className="text-muted text-sm">{info.row.original.operation}</div>
        </div>
      ),
    }),
    columnHelper.accessor("requestedModel", {
      header: () => (
        <SortHeader label="Model" column="requestedModel" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => (
        <ModelLabel
          model={info.getValue()}
          provider={info.row.original.provider}
          interactive
        />
      ),
    }),
    columnHelper.accessor("inputTokens", {
      header: () => (
        <SortHeader label="In" column="inputTokens" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => fmtTokens(info.getValue()),
      size: 78,
      meta: { align: "right" },
    }),
    columnHelper.accessor("cachedInputTokens", {
      header: () => (
        <SortHeader label="Cached" column="cachedInputTokens" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => fmtTokens(info.getValue()),
      size: 78,
    }),
    columnHelper.accessor("outputTokens", {
      header: () => (
        <SortHeader label="Out" column="outputTokens" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => fmtTokens(info.getValue()),
      size: 78,
    }),
    columnHelper.accessor("totalCost", {
      header: () => (
        <SortHeader label="Cost" column="totalCost" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => <CostDisplay usd={info.getValue()} className="text-sm" />,
      size: 88,
    }),
    columnHelper.accessor("timestamp", {
      header: () => (
        <SortHeader label="Time" column="timestamp" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => (
        <span className="text-sm text-secondary" title={formatDateTimeDe(info.getValue())}>
          {formatDateTimeShortDe(info.getValue())}
        </span>
      ),
      size: 140,
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
  const numericCols = new Set(["inputTokens", "cachedInputTokens", "outputTokens", "totalCost"]);

  return (
    <div className="page page--wide">
      <PageHeader title="Events" />

      <div className="filter-bar" role="search" aria-label="Event filters">
        <div className="filter-bar__field filter-bar__field--app">
          <label htmlFor="filter-app">Application</label>
          <input
            id="filter-app"
            placeholder="Application ID"
            value={search.applicationId ?? ""}
            onChange={(e) => setFilter("applicationId", e.target.value)}
          />
        </div>
        <div className="filter-bar__field filter-bar__field--status">
          <label htmlFor="filter-status">Status</label>
          <select
            id="filter-status"
            value={search.status ?? ""}
            onChange={(e) => setFilter("status", e.target.value)}
          >
            <option value="">All</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div className="filter-bar__field filter-bar__field--env">
          <label htmlFor="filter-env">Environment</label>
          <input
            id="filter-env"
            placeholder="e.g. production"
            value={search.environment ?? ""}
            onChange={(e) => setFilter("environment", e.target.value)}
          />
        </div>
        <div className="filter-bar__field filter-bar__field--feature">
          <label htmlFor="filter-feature">Feature</label>
          <input
            id="filter-feature"
            placeholder="Feature"
            value={search.feature ?? ""}
            onChange={(e) => setFilter("feature", e.target.value)}
          />
        </div>
        <div className="filter-bar__field filter-bar__field--provider">
          <label htmlFor="filter-provider">Provider</label>
          <input
            id="filter-provider"
            placeholder="Provider"
            value={search.provider ?? ""}
            onChange={(e) => setFilter("provider", e.target.value)}
          />
        </div>
        {hasFilters && (
          <div className="filter-bar__actions">
            <button type="button" className="btn" onClick={clearFilters}>
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="events-meta">
        <div className="text-muted text-sm">
          <span className="num">{result.total.toLocaleString()}</span> event{result.total !== 1 ? "s" : ""}
          {result.total > result.pageSize && (
            <> · page <span className="num">{result.page}</span> of <span className="num">{totalPages}</span></>
          )}
        </div>
        <label className="cluster text-muted text-sm">
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

      <div className="events-desktop table-wrap">
        <table className="events-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const id = header.column.id;
                  const num = numericCols.has(id);
                  return (
                    <th
                      key={header.id}
                      className={num ? "num-col" : undefined}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="empty-state">
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
                    <td
                      key={cell.id}
                      className={numericCols.has(cell.column.id) ? "num-col" : undefined}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="events-mobile">
        {result.items.length === 0 ? (
          <div className="empty-state">No events found</div>
        ) : (
          result.items.map((item) => (
            <EventListCard key={item.eventId} event={item} />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="events-pagination">
          <button
            type="button"
            className="btn"
            disabled={result.page <= 1}
            onClick={() => navigate({ search: (prev) => ({ ...prev, page: result.page - 1 }) })}
          >
            ← Prev
          </button>
          <span className="text-muted text-sm num">
            Page {result.page} / {totalPages}
          </span>
          <button
            type="button"
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
