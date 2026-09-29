import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  fetchPricing,
  fetchMissingPricingModels,
  createPricingFn,
  updatePricingFn,
  previewPricingImport,
  executePricingImport,
} from "../../server-functions/pricing.js";
import type { PricingRecord } from "../../domain/pricing/pricing-schema.js";
import type { MissingPricingModel } from "../../domain/pricing/pricing-service.js";
import type { ImportPreview } from "../../domain/pricing/import-service.js";
import { parseImportFile } from "../../domain/pricing/import-schema.js";
import { formatPricePrecise, formatPriceUsd } from "../../lib/format-cost.js";
import { formatDateDe } from "../../lib/format-date.js";
import { PageHeader } from "../../components/ui/PageHeader.js";
import { EmptyState } from "../../components/ui/EmptyState.js";
import { Badge } from "../../components/ui/Badge.js";

interface LoaderData {
  pricing: PricingRecord[];
  missing: MissingPricingModel[];
}

export const Route = createFileRoute("/pricing/")({
  loader: async (): Promise<LoaderData> => {
    const [pricing, missing] = await Promise.all([
      fetchPricing(),
      fetchMissingPricingModels(),
    ]);
    return { pricing, missing };
  },
  component: PricingPage,
});

interface PricingFormState {
  provider: string;
  model: string;
  inputPricePerMillion: string;
  cachedInputPricePerMillion: string;
  outputPricePerMillion: string;
  validFrom: string;
  validUntil: string;
  source: string;
}

const emptyForm = (): PricingFormState => ({
  provider: "",
  model: "",
  inputPricePerMillion: "",
  cachedInputPricePerMillion: "",
  outputPricePerMillion: "",
  validFrom: "",
  validUntil: "",
  source: "",
});

function toIso(s: string): string | undefined {
  if (!s) return undefined;
  if (s.includes("T")) return s.endsWith("Z") ? s : s + "Z";
  return s + "T00:00:00.000Z";
}

function PriceCell({ value }: { value: string }) {
  return (
    <span className="mono num" title={formatPricePrecise(value)}>
      {formatPriceUsd(value)}
    </span>
  );
}

function ValidityUntil({ until }: { until: string | null | undefined }) {
  if (!until) {
    return <Badge variant="neutral">Open</Badge>;
  }
  return <span className="text-sm text-secondary">{formatDateDe(until)}</span>;
}

function PricingActions({
  record,
  onEdit,
  onCopy,
}: {
  record: PricingRecord;
  onEdit: (r: PricingRecord) => void;
  onCopy: (r: PricingRecord) => void;
}) {
  return (
    <div className="cluster">
      <button type="button" className="btn btn-sm" onClick={() => onEdit(record)}>Edit</button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => onCopy(record)}>Copy</button>
    </div>
  );
}

function PricingCard({
  record,
  onEdit,
  onCopy,
}: {
  record: PricingRecord;
  onEdit: (r: PricingRecord) => void;
  onCopy: (r: PricingRecord) => void;
}) {
  return (
    <div className="pricing-card">
      <div className="pricing-card__model mono">{record.model}</div>
      <div className="pricing-card__prices">
        <div>
          <span className="pricing-card__label">Input / 1M</span>
          <PriceCell value={record.inputPricePerMillion} />
        </div>
        <div>
          <span className="pricing-card__label">Cached / 1M</span>
          <PriceCell value={record.cachedInputPricePerMillion} />
        </div>
        <div>
          <span className="pricing-card__label">Output / 1M</span>
          <PriceCell value={record.outputPricePerMillion} />
        </div>
      </div>
      <div className="pricing-card__validity text-sm">
        <span className="text-muted">From {formatDateDe(record.validFrom)}</span>
        <span className="text-muted">·</span>
        <ValidityUntil until={record.validUntil} />
      </div>
      <div className="pricing-card__actions">
        <PricingActions record={record} onEdit={onEdit} onCopy={onCopy} />
      </div>
    </div>
  );
}

function PricingPage() {
  const { pricing, missing }: LoaderData = Route.useLoaderData();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PricingFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [affectedMsg, setAffectedMsg] = useState<string | null>(null);

  const [importError, setImportError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [importFile, setImportFile] = useState<any>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [showPasteArea, setShowPasteArea] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, PricingRecord[]>();
    for (const p of pricing) {
      const list = map.get(p.provider) ?? [];
      list.push(p);
      map.set(p.provider, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [pricing]);

  function setField(field: keyof PricingFormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function openCreate(prefill?: Partial<PricingFormState>) {
    setEditId(null);
    setForm({ ...emptyForm(), ...prefill });
    setShowForm(true);
    setFormError(null);
    setAffectedMsg(null);
  }

  function openEdit(record: PricingRecord) {
    setEditId(record.id);
    setForm({
      provider: record.provider,
      model: record.model,
      // Preserve exact stored decimals in the form
      inputPricePerMillion: record.inputPricePerMillion,
      cachedInputPricePerMillion: record.cachedInputPricePerMillion,
      outputPricePerMillion: record.outputPricePerMillion,
      validFrom: record.validFrom.slice(0, 16),
      validUntil: record.validUntil ? record.validUntil.slice(0, 16) : "",
      source: record.source ?? "",
    });
    setShowForm(true);
    setFormError(null);
    setAffectedMsg(null);
  }

  function openCopy(record: PricingRecord) {
    openCreate({
      provider: record.provider,
      model: record.model,
      inputPricePerMillion: record.inputPricePerMillion,
      cachedInputPricePerMillion: record.cachedInputPricePerMillion,
      outputPricePerMillion: record.outputPricePerMillion,
      source: record.source ?? "",
    });
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAffectedMsg(null);

    const payload = {
      provider: form.provider.trim(),
      model: form.model.trim(),
      inputPricePerMillion: form.inputPricePerMillion.trim(),
      cachedInputPricePerMillion: form.cachedInputPricePerMillion.trim(),
      outputPricePerMillion: form.outputPricePerMillion.trim(),
      validFrom: toIso(form.validFrom) ?? "",
      validUntil: form.validUntil ? toIso(form.validUntil) : undefined,
      source: form.source.trim() || undefined,
    };

    try {
      if (editId) {
        const result = await updatePricingFn({ data: { id: editId, data: payload } });
        setAffectedMsg(`Saved. ${result.affectedEvents} event(s) recalculated.`);
      } else {
        const result = await createPricingFn({ data: payload });
        setAffectedMsg(`Created. ${result.affectedEvents} event(s) priced.`);
      }
      setShowForm(false);
      setEditId(null);
      void router.invalidate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save");
    }
  }

  async function processImportText(text: string) {
    setImportError(null);
    setImportPreview(null);
    setImportFile(null);
    setImportSuccess(null);
    setImportLoading(true);
    try {
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON: could not parse");
      }
      const parsed = parseImportFile(raw);
      const preview = await previewPricingImport({ data: { importFile: parsed } });
      setImportFile(parsed);
      setImportPreview(preview);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to parse");
    } finally {
      setImportLoading(false);
    }
  }

  async function handleImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = "";
    await processImportText(text);
  }

  async function handlePasteSubmit() {
    if (!pasteText.trim()) return;
    await processImportText(pasteText);
    setShowPasteArea(false);
    setPasteText("");
  }

  async function handleImportConfirm() {
    if (!importFile) return;
    setImportLoading(true);
    setImportError(null);
    try {
      const result = await executePricingImport({ data: { importFile } });
      setImportSuccess(`Imported ${result.imported} pricing record${result.imported !== 1 ? "s" : ""}.`);
      setImportPreview(null);
      setImportFile(null);
      void router.invalidate();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportLoading(false);
    }
  }

  function handleImportCancel() {
    setImportPreview(null);
    setImportFile(null);
    setImportError(null);
    setImportSuccess(null);
    setShowPasteArea(false);
    setPasteText("");
  }

  return (
    <div className="page page--wide">
      <PageHeader
        title="Pricing"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => openCreate()}>
            + New pricing record
          </button>
        }
      />

      {affectedMsg && <div className="success-box">{affectedMsg}</div>}

      {missing.length > 0 && (
        <div className="section">
          <h2 className="section-title text-warn">
            ⚠ Missing pricing ({missing.length} model{missing.length !== 1 ? "s" : ""})
          </h2>
          <div className="stack">
            {missing.map((m) => (
              <div key={`${m.provider}|${m.model}`} className="alert alert--warning missing-row">
                <div className="missing-row__body">
                  <div>
                    <span className="mono">{m.provider}</span>
                    <span className="text-muted"> / </span>
                    <span className="mono">{m.model}</span>
                  </div>
                  <div className="text-muted text-sm">
                    <span className="num">{m.eventCount.toLocaleString("de-DE")}</span> event
                    {m.eventCount !== 1 ? "s" : ""} · {formatDateDe(m.earliestEvent)} – {formatDateDe(m.latestEvent)}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => openCreate({ provider: m.provider, model: m.model })}
                >
                  Create pricing
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card admin-panel" style={{ marginBottom: "var(--space-5)" }}>
          <h2 className="section-title">{editId ? "Edit pricing record" : "New pricing record"}</h2>
          <form onSubmit={submitForm}>
            <div className="grid-form">
              <div className="field-row">
                <label>Provider</label>
                <input value={form.provider} onChange={(e) => setField("provider", e.target.value)} required placeholder="e.g. openai" className="mono" />
              </div>
              <div className="field-row">
                <label>Model</label>
                <input value={form.model} onChange={(e) => setField("model", e.target.value)} required placeholder="e.g. gpt-4o" className="mono" />
              </div>
              <div className="field-row">
                <label>Input price / 1M tokens (USD)</label>
                <input value={form.inputPricePerMillion} onChange={(e) => setField("inputPricePerMillion", e.target.value)} required placeholder="e.g. 2.50" className="mono" />
              </div>
              <div className="field-row">
                <label>Cached input price / 1M tokens (USD)</label>
                <input value={form.cachedInputPricePerMillion} onChange={(e) => setField("cachedInputPricePerMillion", e.target.value)} required placeholder="e.g. 1.25" className="mono" />
              </div>
              <div className="field-row">
                <label>Output price / 1M tokens (USD)</label>
                <input value={form.outputPricePerMillion} onChange={(e) => setField("outputPricePerMillion", e.target.value)} required placeholder="e.g. 10.00" className="mono" />
              </div>
              <div className="field-row">
                <label>Source / reference (optional)</label>
                <input value={form.source} onChange={(e) => setField("source", e.target.value)} placeholder="e.g. https://openai.com/pricing" />
              </div>
              <div className="field-row">
                <label>Valid from</label>
                <input type="datetime-local" value={form.validFrom} onChange={(e) => setField("validFrom", e.target.value)} required />
              </div>
              <div className="field-row">
                <label>Valid until (blank = open)</label>
                <input type="datetime-local" value={form.validUntil} onChange={(e) => setField("validUntil", e.target.value)} />
              </div>
            </div>
            {formError && <div className="error-box">{formError}</div>}
            <div className="cluster" style={{ marginTop: "var(--space-1)" }}>
              <button type="submit" className="btn btn-primary">{editId ? "Save changes" : "Create"}</button>
              <button type="button" className="btn" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Pricing catalogue ({pricing.length})</h2>
        {pricing.length === 0 ? (
          <EmptyState inline>No pricing records yet.</EmptyState>
        ) : (
          <div className="pricing-catalogue">
            {grouped.map(([provider, records]) => (
              <div key={provider} className="pricing-group">
                <h3 className="pricing-group__title">
                  <span className="mono">{provider}</span>
                  <span className="text-muted text-sm">{records.length}</span>
                </h3>

                <div className="pricing-desktop table-wrap">
                  <table className="pricing-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th className="num-col">Input / 1M</th>
                        <th className="num-col">Cached / 1M</th>
                        <th className="num-col">Output / 1M</th>
                        <th>Valid from</th>
                        <th>Valid until</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((p) => (
                        <tr key={p.id}>
                          <td className="mono pricing-table__model">{p.model}</td>
                          <td className="num-col"><PriceCell value={p.inputPricePerMillion} /></td>
                          <td className="num-col"><PriceCell value={p.cachedInputPricePerMillion} /></td>
                          <td className="num-col"><PriceCell value={p.outputPricePerMillion} /></td>
                          <td className="text-sm">{formatDateDe(p.validFrom)}</td>
                          <td><ValidityUntil until={p.validUntil} /></td>
                          <td>
                            <PricingActions record={p} onEdit={openEdit} onCopy={openCopy} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pricing-mobile stack">
                  {records.map((p) => (
                    <PricingCard key={p.id} record={p} onEdit={openEdit} onCopy={openCopy} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <section className="section import-section">
        <div className="import-section__header">
          <h2 className="section-title">Import</h2>
          <p className="import-section__hint text-muted text-sm">
            Add or update catalogue prices from a JSON file.
          </p>
        </div>
        {importSuccess && <div className="success-box">{importSuccess}</div>}
        {importError && <div className="error-box">{importError}</div>}
        {!importPreview && (
          <div className="stack">
            <div className="import-actions">
              <label className="btn-file">
                <span className="btn">
                  {importLoading ? "Parsing…" : "Choose JSON file"}
                </span>
                <input
                  type="file"
                  accept=".json"
                  disabled={importLoading}
                  onChange={handleImportFileChange}
                />
              </label>
              <button
                type="button"
                className="btn"
                disabled={importLoading}
                onClick={() => setShowPasteArea((v) => !v)}
              >
                {showPasteArea ? "Cancel paste" : "Paste JSON"}
              </button>
            </div>
            {showPasteArea && (
              <div className="import-paste-panel stack">
                <textarea
                  rows={8}
                  className="mono import-paste"
                  placeholder='{"provider": "...", "prices": [...]}'
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  disabled={importLoading}
                />
                <div className="import-paste-panel__actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={importLoading || !pasteText.trim()}
                    onClick={handlePasteSubmit}
                  >
                    {importLoading ? "Parsing…" : "Preview import"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {importPreview && (
          <div className="import-preview">
            <div className="text-sm text-secondary" style={{ marginBottom: "var(--space-2)" }}>
              Provider: <span className="mono">{importPreview.provider}</span>
              {importPreview.source && (
                <> · Source: <span className="mono">{importPreview.source}</span></>
              )}
            </div>
            <div className="cluster text-sm" style={{ marginBottom: "var(--space-3)" }}>
              <span className="text-success">✓ {importPreview.totalNew} new</span>
              <span className="text-muted">= {importPreview.totalUnchanged} unchanged</span>
              {importPreview.totalConflicts > 0 && (
                <span className="text-error">
                  ✗ {importPreview.totalConflicts} conflict{importPreview.totalConflicts !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {importPreview.totalConflicts > 0 && (
              <div className="error-box" style={{ marginBottom: "var(--space-2)" }}>
                Conflicts detected — resolve before importing. Edit or remove conflicting records first.
              </div>
            )}
            <div className="table-wrap pricing-desktop" style={{ marginBottom: "var(--space-3)" }}>
              <table className="pricing-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Valid From</th>
                    <th>Valid Until</th>
                    <th className="num-col">Input/M</th>
                    <th className="num-col">Cached/M</th>
                    <th className="num-col">Output/M</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.entries.map((e, i) => (
                    <tr key={i}>
                      <td className="mono pricing-table__model">{e.entry.model}</td>
                      <td className="text-sm">{formatDateDe(e.entry.validFrom)}</td>
                      <td><ValidityUntil until={e.entry.validUntil} /></td>
                      <td className="num-col"><PriceCell value={e.entry.inputPerMillion} /></td>
                      <td className="num-col"><PriceCell value={e.entry.cachedInputPerMillion} /></td>
                      <td className="num-col"><PriceCell value={e.entry.outputPerMillion} /></td>
                      <td>
                        {e.status === "new" && <Badge variant="success">New</Badge>}
                        {e.status === "unchanged" && <Badge variant="neutral">Unchanged</Badge>}
                        {e.status === "conflict" && (
                          <Badge variant="danger" title={e.conflictReason}>Conflict</Badge>
                        )}
                        {e.status === "conflict" && e.conflictReason && (
                          <div className="text-error text-sm" style={{ maxWidth: 200, marginTop: 4 }}>
                            {e.conflictReason}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pricing-mobile stack" style={{ marginBottom: "var(--space-3)" }}>
              {importPreview.entries.map((e, i) => (
                <div key={i} className="pricing-card">
                  <div className="pricing-card__top">
                    <span className="pricing-card__model mono">{e.entry.model}</span>
                    {e.status === "new" && <Badge variant="success">New</Badge>}
                    {e.status === "unchanged" && <Badge variant="neutral">Unchanged</Badge>}
                    {e.status === "conflict" && <Badge variant="danger">Conflict</Badge>}
                  </div>
                  <div className="pricing-card__prices">
                    <div>
                      <span className="pricing-card__label">Input / 1M</span>
                      <PriceCell value={e.entry.inputPerMillion} />
                    </div>
                    <div>
                      <span className="pricing-card__label">Cached / 1M</span>
                      <PriceCell value={e.entry.cachedInputPerMillion} />
                    </div>
                    <div>
                      <span className="pricing-card__label">Output / 1M</span>
                      <PriceCell value={e.entry.outputPerMillion} />
                    </div>
                  </div>
                  <div className="pricing-card__validity text-sm">
                    <span className="text-muted">From {formatDateDe(e.entry.validFrom)}</span>
                    <span className="text-muted">·</span>
                    <ValidityUntil until={e.entry.validUntil} />
                  </div>
                </div>
              ))}
            </div>
            <div className="cluster">
              <button
                type="button"
                className="btn btn-primary"
                disabled={importLoading || importPreview.totalNew === 0 || importPreview.totalConflicts > 0}
                onClick={handleImportConfirm}
              >
                {importLoading ? "Importing…" : `Import ${importPreview.totalNew} record${importPreview.totalNew !== 1 ? "s" : ""}`}
              </button>
              <button type="button" className="btn" onClick={handleImportCancel}>Cancel</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
