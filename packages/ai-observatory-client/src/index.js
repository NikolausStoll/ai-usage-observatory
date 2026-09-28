/**
 * Fire-and-forget client for AI Usage Observatory.
 * Never throws to callers; missing URL/key is a no-op.
 *
 * @see https://github.com/NikolausStoll/ai-usage-observatory/blob/main/docs/api.md
 */

import { randomUUID } from "node:crypto";

/**
 * @param {string} [fallback]
 * @returns {string}
 */
export function resolveEnvironment(fallback) {
  if (fallback != null && String(fallback).trim() !== "") {
    return String(fallback).trim();
  }
  const env = process.env.NODE_ENV;
  if (env != null && String(env).trim() !== "") return String(env).trim();
  return "production";
}

/**
 * @param {import("./index.js").ObservatoryEventInput} partial
 * @param {{ environment?: string }} [options]
 * @returns {import("./index.js").ObservatoryEvent}
 */
export function buildEvent(partial, options = {}) {
  return {
    ...partial,
    eventId: partial.eventId ?? randomUUID(),
    timestamp: partial.timestamp ?? new Date().toISOString(),
    durationMs: partial.durationMs ?? 0,
    attemptNumber: partial.attemptNumber ?? 1,
    environment:
      partial.environment ?? resolveEnvironment(options.environment),
  };
}

/**
 * @param {import("./index.js").ObservatoryClientOptions} [options]
 * @returns {import("./index.js").ObservatoryClient}
 */
export function createObservatoryClient(options = {}) {
  const baseUrlRaw =
    options.baseUrl !== undefined
      ? options.baseUrl
      : process.env.AI_OBSERVATORY_URL;
  const apiKeyRaw =
    options.apiKey !== undefined
      ? options.apiKey
      : process.env.AI_OBSERVATORY_API_KEY;

  const baseUrl =
    baseUrlRaw != null && String(baseUrlRaw).trim() !== ""
      ? String(baseUrlRaw).replace(/\/+$/, "")
      : "";
  const apiKey =
    apiKeyRaw != null && String(apiKeyRaw).trim() !== ""
      ? String(apiKeyRaw).trim()
      : "";

  const enabled = Boolean(baseUrl && apiKey);
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const warn =
    options.warn ??
    ((message, detail) => {
      if (detail !== undefined) console.warn(message, detail);
      else console.warn(message);
    });
  const defaultEnvironment = options.environment;

  /**
   * @param {import("./index.js").ObservatoryEvent} event
   * @returns {Promise<void>}
   */
  async function postEvent(event) {
    if (!enabled) return;

    const url = `${baseUrl}/api/v1/events`;
    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(event),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        warn(
          `[ai-observatory] POST ${url} failed: ${res.status}${
            text ? ` ${text.slice(0, 200)}` : ""
          }`,
        );
      }
    } catch (err) {
      warn(
        "[ai-observatory] POST failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * @param {import("./index.js").ObservatoryEvent} event
   */
  function report(event) {
    if (!enabled) return;
    try {
      void postEvent(event);
    } catch (err) {
      warn(
        "[ai-observatory] report failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * @param {import("./index.js").ObservatoryEventInput} partial
   */
  function reportEvent(partial) {
    if (!enabled) return;
    try {
      report(buildEvent(partial, { environment: defaultEnvironment }));
    } catch (err) {
      warn(
        "[ai-observatory] reportEvent failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  return {
    get enabled() {
      return enabled;
    },
    get baseUrl() {
      return baseUrl;
    },
    postEvent,
    report,
    reportEvent,
  };
}
