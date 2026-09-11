import type Database from "better-sqlite3";
import {
  type PricingImportFile,
  type PricingImportEntry,
} from "./import-schema.js";
import { createPricing } from "./pricing-service.js";

// ─── Preview types ────────────────────────────────────────────────────────────

export interface PreviewEntry {
  entry: PricingImportEntry;
  provider: string;
  status: "new" | "unchanged" | "conflict";
  conflictReason?: string;
  existingId?: string;
}

export interface ImportPreview {
  provider: string;
  source?: string;
  entries: PreviewEntry[];
  totalNew: number;
  totalUnchanged: number;
  totalConflicts: number;
}

// ─── Preview ─────────────────────────────────────────────────────────────────

interface ExistingPricingRow {
  id: string;
  input_price_per_million: string;
  cached_input_price_per_million: string;
  output_price_per_million: string;
  valid_from: string;
  valid_until: string | null;
}

export function previewImport(
  db: Database.Database,
  importFile: PricingImportFile
): ImportPreview {
  const { provider, source, prices } = importFile;

  const entries: PreviewEntry[] = prices.map((entry) => {
    const existing = db
      .prepare(
        `SELECT id, input_price_per_million, cached_input_price_per_million,
                output_price_per_million, valid_from, valid_until
         FROM pricing
         WHERE provider = ? AND model = ?`
      )
      .all(provider, entry.model) as ExistingPricingRow[];

    const validUntil = entry.validUntil ?? null;

    // Check for exact match (unchanged)
    const exactMatch = existing.find(
      (r) =>
        r.valid_from === entry.validFrom &&
        r.valid_until === validUntil &&
        r.input_price_per_million === entry.inputPerMillion &&
        r.cached_input_price_per_million === entry.cachedInputPerMillion &&
        r.output_price_per_million === entry.outputPerMillion
    );
    if (exactMatch) {
      return { entry, provider, status: "unchanged", existingId: exactMatch.id };
    }

    // Check for overlap (conflict)
    const conflict = existing.find((r) => intervalsOverlap(entry.validFrom, validUntil, r.valid_from, r.valid_until));
    if (conflict) {
      const conflictRange = `[${conflict.valid_from}, ${conflict.valid_until ?? "∞"})`;
      return {
        entry,
        provider,
        status: "conflict",
        conflictReason: `Overlaps existing record ${conflictRange}`,
        existingId: conflict.id,
      };
    }

    return { entry, provider, status: "new" };
  });

  return {
    provider,
    source,
    entries,
    totalNew: entries.filter((e) => e.status === "new").length,
    totalUnchanged: entries.filter((e) => e.status === "unchanged").length,
    totalConflicts: entries.filter((e) => e.status === "conflict").length,
  };
}

// ─── Execute ──────────────────────────────────────────────────────────────────

export function executeImport(
  db: Database.Database,
  importFile: PricingImportFile
): number {
  const preview = previewImport(db, importFile);

  if (preview.totalConflicts > 0) {
    const models = preview.entries
      .filter((e) => e.status === "conflict")
      .map((e) => `${e.entry.model}: ${e.conflictReason}`)
      .join("; ");
    throw new Error(`Import aborted: conflicts must be resolved first. ${models}`);
  }

  const newEntries = preview.entries.filter((e) => e.status === "new");
  if (newEntries.length === 0) return 0;

  const doImport = db.transaction(() => {
    for (const { entry } of newEntries) {
      createPricing(db, {
        provider: importFile.provider,
        model: entry.model,
        inputPricePerMillion: entry.inputPerMillion,
        cachedInputPricePerMillion: entry.cachedInputPerMillion,
        outputPricePerMillion: entry.outputPerMillion,
        validFrom: entry.validFrom,
        validUntil: entry.validUntil ?? null,
        source: importFile.source,
      });
    }
    return newEntries.length;
  });

  return doImport();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function intervalsOverlap(
  aFrom: string,
  aUntil: string | null,
  bFrom: string,
  bUntil: string | null
): boolean {
  // [aFrom, aUntil) overlaps [bFrom, bUntil) iff aFrom < bUntil AND bFrom < aUntil
  const aBeforeBEnd = aUntil === null || aUntil > bFrom;
  const bBeforeAEnd = bUntil === null || bUntil > aFrom;
  return aBeforeBEnd && bBeforeAEnd;
}
