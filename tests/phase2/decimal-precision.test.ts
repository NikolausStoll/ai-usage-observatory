import { describe, it, expect, beforeEach } from "vitest";
import Decimal from "decimal.js";
import type Database from "better-sqlite3";
import { setupTestDb, createTestApp, makeEvent, stdPricing } from "./helpers.js";
import { createPricing } from "../../src/domain/pricing/pricing-service.js";
import { ingestEvent } from "../../src/domain/events/event-service.js";

let db: Database.Database;

beforeEach(() => {
  db = setupTestDb();
  createTestApp(db);
  createPricing(db, stdPricing);
});

describe("decimal precision accumulation invariant (spec §24.8)", () => {
  it("SUM of materialized costs equals aggregate-token calculation within negligible boundary", () => {
    const COUNT = 1000;
    const INPUT_TOKENS = 17; // deliberately low/odd
    const CACHED_TOKENS = 3;
    const OUTPUT_TOKENS = 7;

    for (let i = 0; i < COUNT; i++) {
      const event = makeEvent({
        usage: {
          inputTokens: INPUT_TOKENS,
          cachedInputTokens: CACHED_TOKENS,
          outputTokens: OUTPUT_TOKENS,
        },
      });
      ingestEvent(db, event as any, "test-app");
    }

    // Sum materialized per-event costs from DB
    const rows = db.prepare("SELECT total_cost FROM events WHERE total_cost IS NOT NULL").all() as Array<{ total_cost: string }>;
    expect(rows).toHaveLength(COUNT);

    const sumMaterialized = rows.reduce(
      (acc, r) => acc.plus(new Decimal(r.total_cost)),
      new Decimal(0)
    );

    // Calculate expected cost from aggregated totals
    const M = new Decimal(1_000_000);
    const totalInput = INPUT_TOKENS * COUNT;
    const totalCached = CACHED_TOKENS * COUNT;
    const totalOutput = OUTPUT_TOKENS * COUNT;

    const uncached = Math.max(totalInput - totalCached, 0);
    const expectedCost = new Decimal(uncached)
      .times(new Decimal(stdPricing.inputPricePerMillion))
      .dividedBy(M)
      .plus(
        new Decimal(totalCached)
          .times(new Decimal(stdPricing.cachedInputPricePerMillion))
          .dividedBy(M)
      )
      .plus(
        new Decimal(totalOutput)
          .times(new Decimal(stdPricing.outputPricePerMillion))
          .dividedBy(M)
      );

    const diff = sumMaterialized.minus(expectedCost).abs();
    // Must be within 1e-6 (no per-event cent rounding)
    expect(diff.lessThan(new Decimal("0.000001"))).toBe(true);
  });

  it("stored costs are decimal strings, not floating point approximations", () => {
    // Price is $30 per million, 1M tokens exactly → cost must be exactly "30.0000000000"
    const event = makeEvent({
      usage: { inputTokens: 1000000, cachedInputTokens: 0, outputTokens: 0 },
    });
    ingestEvent(db, event as any, "test-app");
    const row = db
      .prepare("SELECT input_cost FROM events WHERE event_id = ?")
      .get(event.eventId) as { input_cost: string };
    // Should be exactly representable with no floating-point drift
    expect(row.input_cost).toBe("30.0000000000");
  });
});
