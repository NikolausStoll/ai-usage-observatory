import { randomUUID } from "crypto";
import Decimal from "decimal.js";
import type Database from "better-sqlite3";
import type { CreatePricing, PricingRecord } from "./pricing-schema.js";

// High-precision configuration: 20 significant digits, no scientific notation
Decimal.set({ precision: 20, toExpNeg: -20, toExpPos: 20 });

// ─── Cost Calculation ────────────────────────────────────────────────────────

export interface CostComponents {
  inputCost: string;
  cachedInputCost: string;
  outputCost: string;
  totalCost: string;
}

export function calculateCost(
  inputTokens: number | null | undefined,
  cachedInputTokens: number | null | undefined,
  outputTokens: number | null | undefined,
  pricing: PricingRecord
): CostComponents {
  const inputForPricing = new Decimal(inputTokens ?? 0);
  const cachedForPricing = new Decimal(cachedInputTokens ?? 0);
  const outputForPricing = new Decimal(outputTokens ?? 0);

  const M = new Decimal(1_000_000);

  const uncachedForPricing = Decimal.max(inputForPricing.minus(cachedForPricing), 0);

  const inputCost = uncachedForPricing
    .times(new Decimal(pricing.inputPricePerMillion))
    .dividedBy(M);

  const cachedInputCost = cachedForPricing
    .times(new Decimal(pricing.cachedInputPricePerMillion))
    .dividedBy(M);

  const outputCost = outputForPricing
    .times(new Decimal(pricing.outputPricePerMillion))
    .dividedBy(M);

  const totalCost = inputCost.plus(cachedInputCost).plus(outputCost);

  return {
    inputCost: inputCost.toFixed(10),
    cachedInputCost: cachedInputCost.toFixed(10),
    outputCost: outputCost.toFixed(10),
    totalCost: totalCost.toFixed(10),
  };
}

// ─── Pricing Resolution ──────────────────────────────────────────────────────

export function resolvePricing(
  db: Database.Database,
  provider: string,
  pricingModel: string,
  eventTimestamp: string
): PricingRecord | null {
  const row = db
    .prepare(`
      SELECT * FROM pricing
      WHERE provider = ?
        AND model = ?
        AND valid_from <= ?
        AND (valid_until IS NULL OR valid_until > ?)
      ORDER BY valid_from DESC
      LIMIT 1
    `)
    .get(provider, pricingModel, eventTimestamp, eventTimestamp) as Record<string, unknown> | undefined;

  if (!row) return null;
  return rowToPricingRecord(row);
}

// ─── Overlap Check ───────────────────────────────────────────────────────────

function checkOverlap(
  db: Database.Database,
  provider: string,
  model: string,
  validFrom: string,
  validUntil: string | null,
  excludeId?: string
): boolean {
  // Two half-open intervals [A_from, A_until) and [B_from, B_until) overlap iff:
  //   A_from < B_until (or B_until is null) AND B_from < A_until (or A_until is null)
  let query: string;
  let params: unknown[];

  if (validUntil === null) {
    // New record has no end — overlaps if any existing record starts before "infinity"
    // and overlaps with [validFrom, ∞)
    // Existing [B_from, B_until) overlaps [validFrom, ∞) iff B_until IS NULL OR B_until > validFrom
    query = `
      SELECT 1 FROM pricing
      WHERE provider = ?
        AND model = ?
        AND (valid_until IS NULL OR valid_until > ?)
        ${excludeId ? "AND id != ?" : ""}
      LIMIT 1
    `;
    params = excludeId
      ? [provider, model, validFrom, excludeId]
      : [provider, model, validFrom];
  } else {
    // New record is [validFrom, validUntil)
    // Existing [B_from, B_until) overlaps iff B_from < validUntil AND (B_until IS NULL OR B_until > validFrom)
    query = `
      SELECT 1 FROM pricing
      WHERE provider = ?
        AND model = ?
        AND valid_from < ?
        AND (valid_until IS NULL OR valid_until > ?)
        ${excludeId ? "AND id != ?" : ""}
      LIMIT 1
    `;
    params = excludeId
      ? [provider, model, validUntil, validFrom, excludeId]
      : [provider, model, validUntil, validFrom];
  }

  const row = db.prepare(query).get(...params);
  return !!row;
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export function createPricing(
  db: Database.Database,
  data: CreatePricing
): PricingRecord {
  const validUntil = data.validUntil ?? null;

  if (checkOverlap(db, data.provider, data.model, data.validFrom, validUntil)) {
    throw new Error(
      `Pricing overlap: a pricing record for ${data.provider}/${data.model} already covers part of [${data.validFrom}, ${validUntil ?? "∞"})`
    );
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO pricing (
      id, provider, model,
      input_price_per_million, cached_input_price_per_million, output_price_per_million,
      valid_from, valid_until, source, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, data.provider, data.model,
    data.inputPricePerMillion, data.cachedInputPricePerMillion, data.outputPricePerMillion,
    data.validFrom, validUntil, data.source ?? null, now, now
  );

  const record = getPricing(db, id)!;
  recalculateAffectedEvents(db, record);
  return record;
}

export function updatePricing(
  db: Database.Database,
  id: string,
  data: Partial<CreatePricing>
): PricingRecord {
  const existing = getPricing(db, id);
  if (!existing) throw new Error(`Pricing record ${id} not found`);

  const merged = {
    provider: data.provider ?? existing.provider,
    model: data.model ?? existing.model,
    inputPricePerMillion: data.inputPricePerMillion ?? existing.inputPricePerMillion,
    cachedInputPricePerMillion: data.cachedInputPricePerMillion ?? existing.cachedInputPricePerMillion,
    outputPricePerMillion: data.outputPricePerMillion ?? existing.outputPricePerMillion,
    validFrom: data.validFrom ?? existing.validFrom,
    validUntil: data.validUntil !== undefined ? (data.validUntil ?? null) : existing.validUntil,
    source: data.source ?? existing.source,
  };

  if (checkOverlap(db, merged.provider, merged.model, merged.validFrom, merged.validUntil, id)) {
    throw new Error(
      `Pricing overlap: a pricing record for ${merged.provider}/${merged.model} already covers part of [${merged.validFrom}, ${merged.validUntil ?? "∞"})`
    );
  }

  const now = new Date().toISOString();

  // Perform update + recalculation in a single transaction
  const doUpdate = db.transaction(() => {
    db.prepare(`
      UPDATE pricing SET
        provider = ?, model = ?,
        input_price_per_million = ?, cached_input_price_per_million = ?, output_price_per_million = ?,
        valid_from = ?, valid_until = ?, source = ?, updated_at = ?
      WHERE id = ?
    `).run(
      merged.provider, merged.model,
      merged.inputPricePerMillion, merged.cachedInputPricePerMillion, merged.outputPricePerMillion,
      merged.validFrom, merged.validUntil, merged.source, now,
      id
    );

    const updated = getPricing(db, id)!;
    recalculateAffectedEvents(db, updated);
    return updated;
  });

  return doUpdate();
}

export function getPricing(db: Database.Database, id: string): PricingRecord | null {
  const row = db.prepare("SELECT * FROM pricing WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToPricingRecord(row);
}

export function listPricing(db: Database.Database): PricingRecord[] {
  const rows = db
    .prepare("SELECT * FROM pricing ORDER BY provider, model, valid_from")
    .all() as Array<Record<string, unknown>>;
  return rows.map(rowToPricingRecord);
}

export interface MissingPricingModel {
  provider: string;
  model: string;
  eventCount: number;
  earliestEvent: string;
  latestEvent: string;
}

export function getMissingPricingModels(db: Database.Database): MissingPricingModel[] {
  const rows = db.prepare(`
    SELECT
      provider,
      COALESCE(reported_model, requested_model) as model,
      COUNT(*) as event_count,
      MIN(timestamp) as earliest_event,
      MAX(timestamp) as latest_event
    FROM events
    WHERE pricing_id IS NULL
    GROUP BY provider, model
    ORDER BY provider, model
  `).all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    provider: r["provider"] as string,
    model: r["model"] as string,
    eventCount: r["event_count"] as number,
    earliestEvent: r["earliest_event"] as string,
    latestEvent: r["latest_event"] as string,
  }));
}

// ─── Recalculation ───────────────────────────────────────────────────────────

export function recalculateAffectedEvents(
  db: Database.Database,
  pricing: PricingRecord
): number {
  // Find all events in the pricing window for this provider/model
  let query: string;
  let params: unknown[];

  if (pricing.validUntil === null) {
    query = `
      SELECT event_id, input_tokens, cached_input_tokens, output_tokens,
             requested_model, reported_model
      FROM events
      WHERE provider = ?
        AND (COALESCE(reported_model, requested_model) = ?)
        AND timestamp >= ?
    `;
    params = [pricing.provider, pricing.model, pricing.validFrom];
  } else {
    query = `
      SELECT event_id, input_tokens, cached_input_tokens, output_tokens,
             requested_model, reported_model
      FROM events
      WHERE provider = ?
        AND (COALESCE(reported_model, requested_model) = ?)
        AND timestamp >= ?
        AND timestamp < ?
    `;
    params = [pricing.provider, pricing.model, pricing.validFrom, pricing.validUntil];
  }

  const affectedEvents = db.prepare(query).all(...params) as Array<{
    event_id: string;
    input_tokens: number | null;
    cached_input_tokens: number | null;
    output_tokens: number | null;
    requested_model: string;
    reported_model: string | null;
  }>;

  const updateStmt = db.prepare(`
    UPDATE events SET
      input_cost = ?, cached_input_cost = ?, output_cost = ?, total_cost = ?,
      pricing_id = ?
    WHERE event_id = ?
  `);

  const doRecalc = db.transaction(() => {
    for (const event of affectedEvents) {
      const costs = calculateCost(
        event.input_tokens,
        event.cached_input_tokens,
        event.output_tokens,
        pricing
      );
      updateStmt.run(
        costs.inputCost,
        costs.cachedInputCost,
        costs.outputCost,
        costs.totalCost,
        pricing.id,
        event.event_id
      );
    }
    return affectedEvents.length;
  });

  return doRecalc();
}

// ─── Apply pricing to a single newly ingested event ─────────────────────────

export function applyPricingToEvent(
  db: Database.Database,
  eventId: string,
  provider: string,
  requestedModel: string,
  reportedModel: string | null,
  timestamp: string,
  inputTokens: number | null,
  cachedInputTokens: number | null,
  outputTokens: number | null
): void {
  const pricingModel = reportedModel ?? requestedModel;
  const pricing = resolvePricing(db, provider, pricingModel, timestamp);
  if (!pricing) return;

  const costs = calculateCost(inputTokens, cachedInputTokens, outputTokens, pricing);

  db.prepare(`
    UPDATE events SET
      input_cost = ?, cached_input_cost = ?, output_cost = ?, total_cost = ?,
      pricing_id = ?
    WHERE event_id = ?
  `).run(
    costs.inputCost,
    costs.cachedInputCost,
    costs.outputCost,
    costs.totalCost,
    pricing.id,
    eventId
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToPricingRecord(row: Record<string, unknown>): PricingRecord {
  return {
    id: row["id"] as string,
    provider: row["provider"] as string,
    model: row["model"] as string,
    inputPricePerMillion: row["input_price_per_million"] as string,
    cachedInputPricePerMillion: row["cached_input_price_per_million"] as string,
    outputPricePerMillion: row["output_price_per_million"] as string,
    validFrom: row["valid_from"] as string,
    validUntil: row["valid_until"] as string | null,
    source: row["source"] as string | null,
    createdAt: row["created_at"] as string,
    updatedAt: row["updated_at"] as string,
  };
}
