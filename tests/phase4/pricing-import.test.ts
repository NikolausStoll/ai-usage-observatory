import { describe, test, expect, beforeEach } from "vitest";
import { createTestDb } from "../../src/db/database.js";
import { parseImportFile } from "../../src/domain/pricing/import-schema.js";
import { previewImport, executeImport } from "../../src/domain/pricing/import-service.js";
import type { PricingImportFile } from "../../src/domain/pricing/import-schema.js";
import { createPricing } from "../../src/domain/pricing/pricing-service.js";
import type Database from "better-sqlite3";

function makeValidImport(overrides: Partial<PricingImportFile> = {}): PricingImportFile {
  return {
    schemaVersion: 1,
    provider: "openai",
    source: "https://example.com/pricing",
    prices: [
      {
        model: "gpt-5.6-luna",
        validFrom: "2026-09-01T00:00:00.000Z",
        inputPerMillion: "1.250000000000",
        cachedInputPerMillion: "0.125000000000",
        outputPerMillion: "10.000000000000",
      },
    ],
    ...overrides,
  };
}

describe("parseImportFile", () => {
  test("accepts valid JSON", () => {
    const result = parseImportFile(makeValidImport());
    expect(result.schemaVersion).toBe(1);
    expect(result.provider).toBe("openai");
    expect(result.prices).toHaveLength(1);
  });

  test("rejects unsupported schemaVersion", () => {
    expect(() => parseImportFile({ ...makeValidImport(), schemaVersion: 2 as 1 })).toThrow(
      /Unsupported schemaVersion/
    );
  });

  test("rejects floating-point price strings", () => {
    expect(() =>
      parseImportFile({
        ...makeValidImport(),
        prices: [
          {
            model: "gpt-5",
            validFrom: "2026-09-01T00:00:00.000Z",
            inputPerMillion: "1.25",  // no fractional looks like float but actually passes regex
            cachedInputPerMillion: "0.125",
            outputPerMillion: "10",  // no decimal point — should fail
          },
        ],
      })
    ).toThrow(/decimal string/);
  });

  test("rejects missing required fields", () => {
    expect(() => parseImportFile({ schemaVersion: 1, provider: "openai", prices: [] })).toThrow(
      /at least one entry/
    );
    expect(() => parseImportFile({ schemaVersion: 1, prices: [{ model: "x", validFrom: "2026-01-01T00:00:00Z", inputPerMillion: "1.0", cachedInputPerMillion: "0.5", outputPerMillion: "2.0" }] })).toThrow(
      /provider/
    );
  });

  test("rejects invalid datetime", () => {
    expect(() =>
      parseImportFile({
        ...makeValidImport(),
        prices: [
          {
            model: "gpt-5",
            validFrom: "not-a-date",
            inputPerMillion: "1.0",
            cachedInputPerMillion: "0.5",
            outputPerMillion: "2.0",
          },
        ],
      })
    ).toThrow();
  });

  test("preserves optional source field", () => {
    const result = parseImportFile(makeValidImport());
    expect(result.source).toBe("https://example.com/pricing");

    const noSource = parseImportFile({ ...makeValidImport(), source: undefined });
    expect(noSource.source).toBeUndefined();
  });
});

describe("previewImport", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  test("classifies new entry correctly", () => {
    const preview = previewImport(db, makeValidImport());
    expect(preview.totalNew).toBe(1);
    expect(preview.totalUnchanged).toBe(0);
    expect(preview.totalConflicts).toBe(0);
    expect(preview.entries[0]!.status).toBe("new");
  });

  test("classifies unchanged entry correctly", () => {
    const importData = makeValidImport();
    executeImport(db, importData);

    const preview = previewImport(db, importData);
    expect(preview.totalNew).toBe(0);
    expect(preview.totalUnchanged).toBe(1);
    expect(preview.entries[0]!.status).toBe("unchanged");
  });

  test("classifies conflicting entry correctly", () => {
    // Create a different pricing record for same model+period
    createPricing(db, {
      provider: "openai",
      model: "gpt-5.6-luna",
      inputPricePerMillion: "2.0",
      cachedInputPricePerMillion: "1.0",
      outputPricePerMillion: "5.0",
      validFrom: "2026-08-01T00:00:00.000Z",
      validUntil: null,
    });

    const preview = previewImport(db, makeValidImport());
    expect(preview.totalConflicts).toBe(1);
    expect(preview.entries[0]!.status).toBe("conflict");
    expect(preview.entries[0]!.conflictReason).toMatch(/Overlaps/);
    expect(preview.entries[0]!.existingId).toBeDefined();
  });

  test("handles mixed statuses in one import", () => {
    const priceA = {
      model: "gpt-a",
      validFrom: "2026-01-01T00:00:00.000Z",
      inputPerMillion: "1.0",
      cachedInputPerMillion: "0.5",
      outputPerMillion: "2.0",
    } as const;
    const priceB = {
      model: "gpt-b",
      validFrom: "2026-06-01T00:00:00.000Z",
      inputPerMillion: "3.0",
      cachedInputPerMillion: "1.5",
      outputPerMillion: "6.0",
    } as const;
    const importData: PricingImportFile = {
      schemaVersion: 1,
      provider: "openai",
      prices: [priceA, priceB],
    };
    // Insert gpt-a as existing
    executeImport(db, { ...importData, prices: [priceA] });

    const preview = previewImport(db, importData);
    expect(preview.totalUnchanged).toBe(1);
    expect(preview.totalNew).toBe(1);
    expect(preview.totalConflicts).toBe(0);
  });
});

describe("executeImport", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  test("creates new entries transactionally", () => {
    const count = executeImport(db, makeValidImport());
    expect(count).toBe(1);

    const rows = db.prepare("SELECT * FROM pricing WHERE provider = 'openai'").all();
    expect(rows).toHaveLength(1);
  });

  test("skips unchanged entries", () => {
    executeImport(db, makeValidImport());
    const count = executeImport(db, makeValidImport());
    expect(count).toBe(0);
    const rows = db.prepare("SELECT * FROM pricing WHERE provider = 'openai'").all();
    expect(rows).toHaveLength(1);
  });

  test("throws and does not persist if conflicts exist", () => {
    createPricing(db, {
      provider: "openai",
      model: "gpt-5.6-luna",
      inputPricePerMillion: "9.0",
      cachedInputPricePerMillion: "4.5",
      outputPricePerMillion: "18.0",
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: null,
    });

    const rowsBefore = (db.prepare("SELECT COUNT(*) as cnt FROM pricing").get() as { cnt: number }).cnt;

    expect(() => executeImport(db, makeValidImport())).toThrow(/conflicts/);

    const rowsAfter = (db.prepare("SELECT COUNT(*) as cnt FROM pricing").get() as { cnt: number }).cnt;
    expect(rowsAfter).toBe(rowsBefore);
  });

  test("rolls back on failure mid-batch", () => {
    // Multi-entry import where second entry would conflict with first after insert
    const importData: PricingImportFile = {
      schemaVersion: 1,
      provider: "openai",
      prices: [
        {
          model: "gpt-rollback",
          validFrom: "2026-01-01T00:00:00.000Z",
          inputPerMillion: "1.0",
          cachedInputPerMillion: "0.5",
          outputPerMillion: "2.0",
        },
        {
          // Same model, overlapping range — will conflict after first is inserted in same tx
          model: "gpt-rollback",
          validFrom: "2026-06-01T00:00:00.000Z",
          inputPerMillion: "2.0",
          cachedInputPerMillion: "1.0",
          outputPerMillion: "4.0",
        },
      ],
    };

    // Pre-insert a record that will cause the second entry to be a conflict
    createPricing(db, {
      provider: "openai",
      model: "gpt-rollback",
      inputPricePerMillion: "5.0",
      cachedInputPricePerMillion: "2.5",
      outputPricePerMillion: "10.0",
      validFrom: "2026-05-01T00:00:00.000Z",
      validUntil: null,
    });

    const rowsBefore = (db.prepare("SELECT COUNT(*) as cnt FROM pricing").get() as { cnt: number }).cnt;
    expect(() => executeImport(db, importData)).toThrow(/conflicts/);
    const rowsAfter = (db.prepare("SELECT COUNT(*) as cnt FROM pricing").get() as { cnt: number }).cnt;
    expect(rowsAfter).toBe(rowsBefore);
  });

  test("preserves decimal precision in stored prices", () => {
    executeImport(db, makeValidImport());
    const row = db
      .prepare("SELECT input_price_per_million, cached_input_price_per_million, output_price_per_million FROM pricing WHERE provider = 'openai'")
      .get() as { input_price_per_million: string; cached_input_price_per_million: string; output_price_per_million: string };
    expect(row.input_price_per_million).toBe("1.250000000000");
    expect(row.cached_input_price_per_million).toBe("0.125000000000");
    expect(row.output_price_per_million).toBe("10.000000000000");
  });

  test("triggers historical event recalculation", () => {
    // Insert an event in the pricing window with no cost yet
    db.prepare(`
      INSERT INTO applications (id, display_name, created_at) VALUES ('app1', 'App1', '2026-01-01T00:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO events (
        event_id, application_id, received_at, timestamp, duration_ms, environment,
        feature, operation, operation_id, attempt_number, status, provider, requested_model
      ) VALUES (
        'evt-import-recalc', 'app1', '2026-09-01T00:00:01.000Z', '2026-09-01T00:00:00.000Z',
        100, 'test', 'feat', 'op', 'op-1', 1, 'success', 'openai', 'gpt-5.6-luna'
      )
    `).run();
    db.prepare(`
      UPDATE events SET input_tokens = 1000000, output_tokens = 500000 WHERE event_id = 'evt-import-recalc'
    `).run();

    executeImport(db, makeValidImport());

    const evt = db.prepare("SELECT total_cost, pricing_id FROM events WHERE event_id = 'evt-import-recalc'").get() as {
      total_cost: string | null;
      pricing_id: string | null;
    };
    expect(evt.total_cost).not.toBeNull();
    expect(evt.pricing_id).not.toBeNull();
    // inputCost = 1M * 1.25 / 1M = 1.25, outputCost = 0.5M * 10 / 1M = 5.0, total = 6.25
    expect(parseFloat(evt.total_cost!)).toBeCloseTo(6.25, 8);
  });

  test("stores source field", () => {
    executeImport(db, makeValidImport());
    const row = db.prepare("SELECT source FROM pricing WHERE provider = 'openai'").get() as { source: string | null };
    expect(row.source).toBe("https://example.com/pricing");
  });
});
