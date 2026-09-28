import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  buildEvent,
  createObservatoryClient,
  resolveEnvironment,
} from "../src/index.js";

describe("ai-observatory-client", () => {
  afterEach(() => {
    delete process.env.AI_OBSERVATORY_URL;
    delete process.env.AI_OBSERVATORY_API_KEY;
    delete process.env.NODE_ENV;
  });

  it("resolveEnvironment uses NODE_ENV or production", () => {
    delete process.env.NODE_ENV;
    assert.equal(resolveEnvironment(), "production");
    process.env.NODE_ENV = "development";
    assert.equal(resolveEnvironment(), "development");
    assert.equal(resolveEnvironment("staging"), "staging");
  });

  it("buildEvent fills required defaults", () => {
    process.env.NODE_ENV = "test";
    const event = buildEvent({
      feature: "recipe-import",
      operation: "image-extraction",
      operationId: "recipe-import:1:image-extraction",
      status: "success",
      provider: "openai",
      requestedModel: "gpt-4o-mini",
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });

    assert.match(event.eventId, /^[0-9a-f-]{36}$/i);
    assert.equal(typeof event.timestamp, "string");
    assert.equal(event.durationMs, 0);
    assert.equal(event.attemptNumber, 1);
    assert.equal(event.environment, "test");
    assert.equal(event.feature, "recipe-import");
    assert.equal(event.usage?.inputTokens, 10);
  });

  it("createObservatoryClient is disabled without URL/key", () => {
    const client = createObservatoryClient();
    assert.equal(client.enabled, false);
  });

  it("report is a no-op when disabled", async () => {
    let called = false;
    const client = createObservatoryClient({
      fetch: async () => {
        called = true;
        return new Response("{}", { status: 200 });
      },
    });
    client.report(
      buildEvent({
        feature: "f",
        operation: "o",
        operationId: "f:o",
        status: "success",
        provider: "openai",
        requestedModel: "m",
      }),
    );
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(called, false);
  });

  it("postEvent POSTs when enabled", async () => {
    /** @type {{ url?: string, init?: RequestInit }} */
    const seen = {};
    const client = createObservatoryClient({
      baseUrl: "http://obs.example/",
      apiKey: "obs_key",
      environment: "test",
      fetch: async (url, init) => {
        seen.url = String(url);
        seen.init = init;
        return new Response(JSON.stringify({ received: true }), { status: 200 });
      },
    });

    assert.equal(client.enabled, true);
    assert.equal(client.baseUrl, "http://obs.example");

    const event = buildEvent(
      {
        feature: "health-score",
        operation: "health-score",
        operationId: "health-score:7:health-score",
        status: "error",
        provider: "openai",
        requestedModel: "gpt-4o-mini",
        usage: { inputTokens: 3, outputTokens: 2 },
        error: { message: "failed" },
      },
      { environment: "test" },
    );

    await client.postEvent(event);

    assert.equal(seen.url, "http://obs.example/api/v1/events");
    assert.equal(seen.init?.method, "POST");
    const headers = /** @type {Record<string, string>} */ (seen.init?.headers);
    assert.equal(headers.Authorization, "Bearer obs_key");
    assert.equal(headers["Content-Type"], "application/json");
    const body = JSON.parse(String(seen.init?.body));
    assert.equal(body.status, "error");
    assert.equal(body.feature, "health-score");
    assert.equal(body.usage.inputTokens, 3);
  });

  it("reportEvent fire-and-forget uses env config", async () => {
    process.env.AI_OBSERVATORY_URL = "http://obs.example";
    process.env.AI_OBSERVATORY_API_KEY = "key";
    process.env.NODE_ENV = "test";

    /** @type {{ url?: string }} */
    const seen = {};
    const client = createObservatoryClient({
      fetch: async (url) => {
        seen.url = String(url);
        return new Response("{}", { status: 200 });
      },
    });

    client.reportEvent({
      feature: "f",
      operation: "o",
      operationId: "f:1:o",
      status: "success",
      provider: "openai",
      requestedModel: "m",
    });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(seen.url, "http://obs.example/api/v1/events");
  });

  it("postEvent swallows fetch errors", async () => {
    const warnings = [];
    const client = createObservatoryClient({
      baseUrl: "http://obs.example",
      apiKey: "key",
      warn: (msg, detail) => warnings.push({ msg, detail }),
      fetch: async () => {
        throw new Error("network down");
      },
    });
    await client.postEvent(
      buildEvent({
        feature: "f",
        operation: "o",
        operationId: "f:o",
        status: "success",
        provider: "openai",
        requestedModel: "m",
      }),
    );
    assert.equal(warnings.length, 1);
  });
});
