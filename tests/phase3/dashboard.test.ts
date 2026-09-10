import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../../src/db/database.js";
import { createApplication } from "../../src/domain/applications/application-service.js";
import { ingestEvent } from "../../src/domain/events/event-service.js";
import { createPricing } from "../../src/domain/pricing/pricing-service.js";
import { getDashboardStats } from "../../src/domain/dashboard/dashboard-service.js";

let db: Database.Database;

const makeEvent = (id: string, status: "success" | "error" = "success", tokens?: {
  inputTokens?: number; outputTokens?: number;
}) => ({
  eventId: id,
  timestamp: "2026-09-09T12:00:00.000Z",
  durationMs: 1000,
  environment: "production",
  feature: "feat",
  operation: "op",
  operationId: "op-id",
  attemptNumber: 1,
  status,
  provider: "openai",
  requestedModel: "gpt-4",
  usage: tokens
    ? { inputTokens: tokens.inputTokens ?? null, outputTokens: tokens.outputTokens ?? null, cachedInputTokens: null, reasoningTokens: null, totalTokens: null, rawUsage: null }
    : undefined,
});

beforeEach(() => {
  db = createTestDb();
  createApplication(db, "app-1", "App One");
});

describe("getDashboardStats", () => {
  it("returns zeros when empty", () => {
    const stats = getDashboardStats(db);
    expect(stats.totalEvents).toBe(0);
    expect(stats.successEvents).toBe(0);
    expect(stats.errorEvents).toBe(0);
    expect(stats.totalInputTokens).toBe(0);
    expect(stats.totalOutputTokens).toBe(0);
    expect(stats.missingPricingModels).toBe(0);
    expect(stats.recentEvents).toHaveLength(0);
  });

  it("counts total/success/error events", () => {
    ingestEvent(db, makeEvent("00000000-0000-4000-8000-000000000001", "success"), "app-1");
    ingestEvent(db, makeEvent("00000000-0000-4000-8000-000000000002", "success"), "app-1");
    ingestEvent(db, makeEvent("00000000-0000-4000-8000-000000000003", "error"), "app-1");

    const stats = getDashboardStats(db);
    expect(stats.totalEvents).toBe(3);
    expect(stats.successEvents).toBe(2);
    expect(stats.errorEvents).toBe(1);
  });

  it("sums token counts", () => {
    ingestEvent(db, makeEvent("00000000-0000-4000-8000-000000000001", "success", { inputTokens: 1000, outputTokens: 200 }), "app-1");
    ingestEvent(db, makeEvent("00000000-0000-4000-8000-000000000002", "success", { inputTokens: 500, outputTokens: 100 }), "app-1");

    const stats = getDashboardStats(db);
    expect(stats.totalInputTokens).toBe(1500);
    expect(stats.totalOutputTokens).toBe(300);
  });

  it("counts missing pricing models", () => {
    ingestEvent(db, makeEvent("00000000-0000-4000-8000-000000000001"), "app-1");
    ingestEvent(db, {
      ...makeEvent("00000000-0000-4000-8000-000000000002"),
      provider: "anthropic",
      requestedModel: "claude-3",
    }, "app-1");

    const stats = getDashboardStats(db);
    expect(stats.missingPricingModels).toBe(2);
  });

  it("reflects zero missing when all priced", () => {
    ingestEvent(db, makeEvent("00000000-0000-4000-8000-000000000001"), "app-1");
    createPricing(db, {
      provider: "openai",
      model: "gpt-4",
      inputPricePerMillion: "3.0",
      cachedInputPricePerMillion: "1.5",
      outputPricePerMillion: "6.0",
      validFrom: "2026-01-01T00:00:00.000Z",
    });
    const stats = getDashboardStats(db);
    expect(stats.missingPricingModels).toBe(0);
  });

  it("includes recent events (max 10)", () => {
    for (let i = 1; i <= 12; i++) {
      ingestEvent(db, makeEvent(`00000000-0000-4000-8000-0000000000${i.toString().padStart(2, "0")}`), "app-1");
    }
    const stats = getDashboardStats(db);
    expect(stats.recentEvents).toHaveLength(10);
    expect(stats.totalEvents).toBe(12);
  });

  it("includes application name in recent events", () => {
    ingestEvent(db, makeEvent("00000000-0000-4000-8000-000000000001"), "app-1");
    const stats = getDashboardStats(db);
    expect(stats.recentEvents[0]!.applicationName).toBe("App One");
  });
});
