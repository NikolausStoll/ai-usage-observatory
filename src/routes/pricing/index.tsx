import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  fetchPricing,
  fetchMissingPricingModels,
  createPricingFn,
  updatePricingFn,
} from "../../server-functions/pricing.js";
import type { PricingRecord } from "../../domain/pricing/pricing-schema.js";
import type { MissingPricingModel } from "../../domain/pricing/pricing-service.js";

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

function PricingPage() {
  const { pricing, missing }: LoaderData = Route.useLoaderData();
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PricingFormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [affectedMsg, setAffectedMsg] = useState<string | null>(null);

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

  return (
    <div className="page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>Pricing</h1>
        <button className="btn btn-primary" onClick={() => openCreate()}>+ New pricing record</button>
      </div>

      {affectedMsg && (
        <div className="success-box">{affectedMsg}</div>
      )}

      {missing.length > 0 && (
        <div className="section">
          <h2 style={{ color: "#ff9800" }}>⚠ Missing pricing ({missing.length} model{missing.length !== 1 ? "s" : ""})</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {missing.map((m) => (
              <div key={`${m.provider}|${m.model}`} className="card" style={{ borderColor: "#5a3a00" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <span className="mono" style={{ color: "#ff9800" }}>{m.provider}</span>
                    <span style={{ color: "#666", margin: "0 6px" }}>/</span>
                    <span className="mono" style={{ color: "#ff9800" }}>{m.model}</span>
                    <span style={{ color: "#666", fontSize: "0.85em", marginLeft: 12 }}>
                      {m.eventCount.toLocaleString()} event{m.eventCount !== 1 ? "s" : ""} ·{" "}
                      {new Date(m.earliestEvent).toLocaleDateString()} – {new Date(m.latestEvent).toLocaleDateString()}
                    </span>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: "0.82em" }}
                    onClick={() => openCreate({ provider: m.provider, model: m.model })}
                  >
                    Create pricing
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>{editId ? "Edit pricing record" : "New pricing record"}</h2>
          <form onSubmit={submitForm}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="field-row">
                <label>Provider</label>
                <input value={form.provider} onChange={(e) => setField("provider", e.target.value)} required placeholder="e.g. openai" />
              </div>
              <div className="field-row">
                <label>Model</label>
                <input value={form.model} onChange={(e) => setField("model", e.target.value)} required placeholder="e.g. gpt-4o" />
              </div>
              <div className="field-row">
                <label>Input price / 1M tokens (USD)</label>
                <input value={form.inputPricePerMillion} onChange={(e) => setField("inputPricePerMillion", e.target.value)} required placeholder="e.g. 2.50" />
              </div>
              <div className="field-row">
                <label>Cached input price / 1M tokens (USD)</label>
                <input value={form.cachedInputPricePerMillion} onChange={(e) => setField("cachedInputPricePerMillion", e.target.value)} required placeholder="e.g. 1.25" />
              </div>
              <div className="field-row">
                <label>Output price / 1M tokens (USD)</label>
                <input value={form.outputPricePerMillion} onChange={(e) => setField("outputPricePerMillion", e.target.value)} required placeholder="e.g. 10.00" />
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
                <label>Valid until (leave blank = no end)</label>
                <input type="datetime-local" value={form.validUntil} onChange={(e) => setField("validUntil", e.target.value)} />
              </div>
            </div>
            {formError && <div className="error-box">{formError}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button type="submit" className="btn btn-primary">{editId ? "Save changes" : "Create"}</button>
              <button type="button" className="btn" onClick={() => { setShowForm(false); setEditId(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="section">
        <h2>All pricing records ({pricing.length})</h2>
        {pricing.length === 0 ? (
          <div className="text-muted">No pricing records yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Model</th>
                <th>Input / 1M</th>
                <th>Cached / 1M</th>
                <th>Output / 1M</th>
                <th>Valid from</th>
                <th>Valid until</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pricing.map((p) => (
                <tr key={p.id}>
                  <td className="mono">{p.provider}</td>
                  <td className="mono">{p.model}</td>
                  <td className="mono">${p.inputPricePerMillion}</td>
                  <td className="mono">${p.cachedInputPricePerMillion}</td>
                  <td className="mono">${p.outputPricePerMillion}</td>
                  <td style={{ fontSize: "0.85em" }}>{new Date(p.validFrom).toLocaleDateString()}</td>
                  <td style={{ fontSize: "0.85em", color: p.validUntil ? "#aaa" : "#4caf50" }}>
                    {p.validUntil ? new Date(p.validUntil).toLocaleDateString() : "open"}
                  </td>
                  <td style={{ display: "flex", gap: 4 }}>
                    <button className="btn" style={{ fontSize: "0.78em", padding: "3px 8px" }} onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn" style={{ fontSize: "0.78em", padding: "3px 8px" }} onClick={() => openCreate({
                      provider: p.provider,
                      model: p.model,
                      inputPricePerMillion: p.inputPricePerMillion,
                      cachedInputPricePerMillion: p.cachedInputPricePerMillion,
                      outputPricePerMillion: p.outputPricePerMillion,
                      source: p.source ?? "",
                    })}>Copy</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
