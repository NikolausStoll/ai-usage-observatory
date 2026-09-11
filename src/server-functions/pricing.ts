import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db/database.js";
import {
  listPricing,
  getPricing,
  createPricing,
  updatePricing,
  getMissingPricingModels,
} from "../domain/pricing/pricing-service.js";
import { CreatePricingSchema } from "../domain/pricing/pricing-schema.js";
import { PricingImportFileSchema } from "../domain/pricing/import-schema.js";
import { previewImport, executeImport } from "../domain/pricing/import-service.js";

export const fetchPricing = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb();
    return listPricing(db);
  });

export const fetchMissingPricingModels = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb();
    return getMissingPricingModels(db);
  });

export const fetchPricingById = createServerFn({ method: "GET", strict: false })
  .validator(z.string())
  .handler(async ({ data: id }) => {
    const db = getDb();
    return getPricing(db, id);
  });

export const createPricingFn = createServerFn({ method: "POST", strict: false })
  .validator(CreatePricingSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const record = createPricing(db, data);
    const affected = db.prepare(
      "SELECT COUNT(*) as cnt FROM events WHERE pricing_id = ?"
    ).get(record.id) as { cnt: number };
    return { record, affectedEvents: affected.cnt };
  });

export const updatePricingFn = createServerFn({ method: "POST", strict: false })
  .validator(z.object({ id: z.string().uuid(), data: CreatePricingSchema.partial() }))
  .handler(async ({ data: { id, data } }) => {
    const db = getDb();
    const before = db.prepare(
      "SELECT COUNT(*) as cnt FROM events WHERE pricing_id = ?"
    ).get(id) as { cnt: number };
    const record = updatePricing(db, id, data);
    const after = db.prepare(
      "SELECT COUNT(*) as cnt FROM events WHERE pricing_id = ?"
    ).get(id) as { cnt: number };
    return { record, affectedEvents: Math.max(before.cnt, after.cnt) };
  });

export const previewPricingImport = createServerFn({ method: "POST", strict: false })
  .validator(z.object({ importFile: PricingImportFileSchema }))
  .handler(async ({ data }) => {
    const db = getDb();
    return previewImport(db, data.importFile);
  });

export const executePricingImport = createServerFn({ method: "POST", strict: false })
  .validator(z.object({ importFile: PricingImportFileSchema }))
  .handler(async ({ data }) => {
    const db = getDb();
    const imported = executeImport(db, data.importFile);
    return { imported };
  });
