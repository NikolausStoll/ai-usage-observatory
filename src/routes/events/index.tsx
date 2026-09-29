import { useId, useMemo, useState } from "react";
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
import {
  SearchableSelect,
  decodeFeatureOp,
  encodeFeatureOp,
} from "../../components/SearchableSelect.js";
import { formatDateTimeDe, formatDateTimeShortDe } from "../../lib/format-date.js";
import { formatDurationMs, formatDurationPrecise } from "../../lib/format-duration.js";

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
  operation: z.string().optional(),
  requestedModel: z.string().optional(),
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
  const filtersPanelId = useId();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const sortBy = (search.sortBy ?? "timestamp") as EventSortBy;
  const sortDir = (search.sortDir ?? "desc") as EventSortDir;
  const facets = result.facets;

  const applicationOptions = useMemo(
    () =>
      facets.applications.map((a) => ({
        value: a.id,
        label: a.name,
        keywords: a.id,
      })),
    [facets.applications]
  );

  const environmentOptions = useMemo(
    () => facets.environments.map((env) => ({ value: env, label: env })),
    [facets.environments]
  );

  const featureOpOptions = useMemo(
    () =>
      facets.featureOps.map((fo) => ({
        value: encodeFeatureOp(fo.feature, fo.operation),
        label: fo.operation ? `${fo.feature} · ${fo.operation}` : fo.feature,
        keywords: `${fo.feature} ${fo.operation}`,
      })),
    [facets.featureOps]
  );

  const modelOptions = useMemo(
    () => facets.models.map((m) => ({ value: m, label: m })),
    [facets.models]
  );

  const selectedFeatureOp =
    search.feature != null
      ? encodeFeatureOp(search.feature, search.operation ?? "")
      : "";

  const activeFilterChips: { key: string; label: string }[] = [];
  if (search.applicationId) {
    const name =
      facets.applications.find((a) => a.id === search.applicationId)?.name ??
      search.applicationId;
    activeFilterChips.push({ key: "applicationId", label: `App: ${name}` });
  }
  if (search.status) {
    activeFilterChips.push({ key: "status", label: `Status: ${search.status}` });
  }
  if (search.environment) {
    activeFilterChips.push({ key: "environment", label: `Env: ${search.environment}` });
  }
  if (search.feature) {
    const label = search.operation
      ? `${search.feature} · ${search.operation}`
      : search.feature;
    activeFilterChips.push({ key: "feature", label: `Feature: ${label}` });
  }
  if (search.requestedModel) {
    activeFilterChips.push({ key: "requestedModel", label: `Model: ${search.requestedModel}` });
  }
  const activeFilterCount = activeFilterChips.length;
  const hasFilters = activeFilterCount > 0;

  function setFilter(key: string, value: string) {
    void navigate({
      search: (prev) => ({ ...prev, [key]: value || undefined, page: 1 }),
    });
  }

  function setFeatureOp(value: string) {
    const decoded = value ? decodeFeatureOp(value) : null;
    void navigate({
      search: (prev) => ({
        ...prev,
        feature: decoded?.feature || undefined,
        operation: decoded?.operation || undefined,
        page: 1,
      }),
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
    columnHelper.accessor("durationMs", {
      header: () => (
        <SortHeader label="Duration" column="durationMs" sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
      ),
      cell: (info) => (
        <span className="num text-sm" title={formatDurationPrecise(info.getValue())}>
          {formatDurationMs(info.getValue())}
        </span>
      ),
      size: 72,
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
  const numericCols = new Set([
    "inputTokens",
    "cachedInputTokens",
    "outputTokens",
    "totalCost",
    "durationMs",
  ]);

  return (
    <div className="page page--wide">
      <PageHeader title="Events" />

      <div className="filter-shell">
        <div className="filter-shell__mobile">
          <button
            type="button"
            className="filter-shell__toggle"
            aria-expanded={filtersOpen}
            aria-controls={filtersPanelId}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <span>Filters</span>
            {activeFilterCount > 0 ? (
              <span className="filter-shell__count" aria-label={`${activeFilterCount} active`}>
                {activeFilterCount}
              </span>
            ) : null}
            <span className="filter-shell__chevron" aria-hidden>
              {filtersOpen ? "▴" : "▾"}
            </span>
          </button>
          {hasFilters ? (
            <button type="button" className="btn btn-ghost filter-shell__clear" onClick={clearFilters}>
              Clear
            </button>
          ) : null}
        </div>

        {hasFilters && !filtersOpen ? (
          <div className="filter-shell__summary" aria-label="Active filters">
            {activeFilterChips.map((chip) => (
              <span key={chip.key} className="filter-chip">
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}

        <div
          id={filtersPanelId}
          className={`filter-bar${filtersOpen ? " filter-bar--open" : ""}`}
          role="search"
          aria-label="Event filters"
        >
          <SearchableSelect
            id="filter-app"
            label="Application"
            className="filter-bar__field--app"
            options={applicationOptions}
            value={search.applicationId ?? ""}
            onChange={(v) => setFilter("applicationId", v)}
            placeholder="Search apps…"
          />
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
          <SearchableSelect
            id="filter-env"
            label="Environment"
            className="filter-bar__field--env"
            options={environmentOptions}
            value={search.environment ?? ""}
            onChange={(v) => setFilter("environment", v)}
            placeholder="Search envs…"
          />
          <SearchableSelect
            id="filter-feature"
            label="Feature / Op"
            className="filter-bar__field--feature"
            options={featureOpOptions}
            value={selectedFeatureOp}
            onChange={setFeatureOp}
            placeholder="Search feature or op…"
          />
          <SearchableSelect
            id="filter-model"
            label="Model"
            className="filter-bar__field--model"
            options={modelOptions}
            value={search.requestedModel ?? ""}
            onChange={(v) => setFilter("requestedModel", v)}
            placeholder="Search models…"
          />
          {hasFilters && (
            <div className="filter-bar__actions">
              <button type="button" className="btn" onClick={clearFilters}>
                Clear
              </button>
            </div>
          )}
        </div>
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
