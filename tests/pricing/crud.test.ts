import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { setupTestDb, createTestApp, stdPricing } from "../helpers.js";
import { createPricing, getPricing, listPricing, resolvePricing } from "../../src/domain/pricing/pricing-service.js";
import type { CreatePricing } from "../../src/domain/pricing/pricing-schema.js";

let db: Database.Database;

beforeEach(() => {
  db = setupTestDb();
  createTestApp(db);
});

describe("pricing CRUD", () => {
  it("creates a pricing record", () => {
    const record = createPricing(db, stdPricing);
    expect(record.id).toBeTruthy();
    expect(record.provider).toBe("openai");
    expect(record.model).toBe("gpt-4");
    expect(record.inputPricePerMillion).toBe("30");
    expect(record.cachedInputPricePerMillion).toBe("15");
    expect(record.outputPricePerMillion).toBe("60");
    expect(record.validFrom).toBe("2026-01-01T00:00:00.000Z");
    expect(record.validUntil).toBeNull();
  });

  it("retrieves a pricing record by id", () => {
    const created = createPricing(db, stdPricing);
    const fetched = getPricing(db, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(created.id);
  });

  it("lists pricing records", () => {
    createPricing(db, stdPricing);
    createPricing(db, { ...stdPricing, model: "gpt-3.5", validFrom: "2026-01-01T00:00:00.000Z" });
    const list = listPricing(db);
    expect(list).toHaveLength(2);
  });
});

describe("pricing overlap prevention", () => {
  it("prevents overlapping pricing (both open-ended)", () => {
    createPricing(db, stdPricing);
    expect(() => createPricing(db, { ...stdPricing, inputPricePerMillion: "25" })).toThrow(/overlap/i);
  });

  it("prevents overlapping pricing (new record starts before existing one ends)", () => {
    createPricing(db, {
      ...stdPricing,
      validFrom: "2026-06-01T00:00:00.000Z",
      validUntil: "2026-12-01T00:00:00.000Z",
    });
    // This overlaps
    expect(() =>
      createPricing(db, {
        ...stdPricing,
        validFrom: "2026-01-01T00:00:00.000Z",
        validUntil: "2026-07-01T00:00:00.000Z",
      })
    ).toThrow(/overlap/i);
  });

  it("allows adjacent non-overlapping ranges (gap)", () => {
    createPricing(db, {
      ...stdPricing,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-06-01T00:00:00.000Z",
    });
    // Adjacent (no gap, no overlap)
    expect(() =>
      createPricing(db, {
        ...stdPricing,
        validFrom: "2026-06-01T00:00:00.000Z",
        validUntil: null,
      })
    ).not.toThrow();
  });

  it("allows gap between two ranges", () => {
    createPricing(db, {
      ...stdPricing,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-04-01T00:00:00.000Z",
    });
    expect(() =>
      createPricing(db, {
        ...stdPricing,
        validFrom: "2026-06-01T00:00:00.000Z",
        validUntil: null,
      })
    ).not.toThrow();
  });

  it("different provider+model can have same time range", () => {
    createPricing(db, stdPricing);
    expect(() =>
      createPricing(db, { ...stdPricing, provider: "anthropic", model: "claude-3" })
    ).not.toThrow();
  });
});

describe("pricing resolution", () => {
  it("resolves pricing for exact provider+model match", () => {
    createPricing(db, stdPricing);
    const p = resolvePricing(db, "openai", "gpt-4", "2026-09-09T12:00:00.000Z");
    expect(p).not.toBeNull();
    expect(p!.model).toBe("gpt-4");
  });

  it("event at validFrom is within range", () => {
    createPricing(db, { ...stdPricing, validFrom: "2026-09-09T12:00:00.000Z" });
    const p = resolvePricing(db, "openai", "gpt-4", "2026-09-09T12:00:00.000Z");
    expect(p).not.toBeNull();
  });

  it("event before validFrom is not matched", () => {
    createPricing(db, { ...stdPricing, validFrom: "2026-09-09T12:00:00.000Z" });
    const p = resolvePricing(db, "openai", "gpt-4", "2026-09-09T11:59:59.999Z");
    expect(p).toBeNull();
  });

  it("event at validUntil is not within range (half-open)", () => {
    createPricing(db, {
      ...stdPricing,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-09-09T12:00:00.000Z",
    });
    const p = resolvePricing(db, "openai", "gpt-4", "2026-09-09T12:00:00.000Z");
    expect(p).toBeNull();
  });

  it("event before validUntil is within range", () => {
    createPricing(db, {
      ...stdPricing,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-09-09T12:00:01.000Z",
    });
    const p = resolvePricing(db, "openai", "gpt-4", "2026-09-09T12:00:00.000Z");
    expect(p).not.toBeNull();
  });

  it("validUntil null means open-ended", () => {
    createPricing(db, { ...stdPricing, validFrom: "2020-01-01T00:00:00.000Z", validUntil: null });
    const p = resolvePricing(db, "openai", "gpt-4", "2099-01-01T00:00:00.000Z");
    expect(p).not.toBeNull();
  });

  it("gap between two pricing records produces no pricing", () => {
    createPricing(db, {
      ...stdPricing,
      validFrom: "2026-01-01T00:00:00.000Z",
      validUntil: "2026-06-01T00:00:00.000Z",
    });
    createPricing(db, {
      ...stdPricing,
      validFrom: "2026-09-01T00:00:00.000Z",
      validUntil: null,
    });
    // In the gap
    const p = resolvePricing(db, "openai", "gpt-4", "2026-07-15T00:00:00.000Z");
    expect(p).toBeNull();
  });

  it("no match for different provider", () => {
    createPricing(db, stdPricing);
    const p = resolvePricing(db, "anthropic", "gpt-4", "2026-09-09T12:00:00.000Z");
    expect(p).toBeNull();
  });

  it("no match for different model", () => {
    createPricing(db, stdPricing);
    const p = resolvePricing(db, "openai", "gpt-3.5", "2026-09-09T12:00:00.000Z");
    expect(p).toBeNull();
  });
});
