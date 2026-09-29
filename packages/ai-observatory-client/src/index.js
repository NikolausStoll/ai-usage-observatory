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
 * Normalize binary input for multipart upload.
 * @param {import("./index.js").ArtifactBinary} data
 * @param {string} [mimeType]
 * @param {string} [filename]
 * @returns {Blob}
 */
function toUploadBlob(data, mimeType, filename) {
  const type = mimeType ?? "application/octet-stream";
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    return data;
  }

  /** @type {Uint8Array} */
  let bytes;
  if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (ArrayBuffer.isView(data)) {
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else {
    throw new TypeError("Artifact data must be Buffer, Uint8Array, ArrayBuffer, or Blob");
  }

  if (typeof File !== "undefined") {
    return new File([bytes], filename ?? "artifact", { type });
  }
  return new Blob([bytes], { type });
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

  /**
   * Upload an artifact for an existing event (`POST .../events/{id}/artifacts`).
   * Never throws; returns `null` when disabled or on failure.
   *
   * @param {string} eventId
   * @param {import("./index.js").UploadArtifactInput} input
   * @returns {Promise<import("./index.js").UploadArtifactResult | null>}
   */
  async function uploadArtifact(eventId, input) {
    if (!enabled) return null;
    if (!eventId || typeof eventId !== "string") {
      warn("[ai-observatory] uploadArtifact: eventId is required");
      return null;
    }
    if (input?.role !== "input" && input?.role !== "output") {
      warn("[ai-observatory] uploadArtifact: role must be 'input' or 'output'");
      return null;
    }
    if (input?.data == null) {
      warn("[ai-observatory] uploadArtifact: data is required");
      return null;
    }

    const url = `${baseUrl}/api/v1/events/${encodeURIComponent(eventId)}/artifacts`;
    try {
      const form = new FormData();
      form.append("role", input.role);
      if (input.label != null && String(input.label).trim() !== "") {
        form.append("label", String(input.label));
      }

      const filename = input.filename ?? "artifact";
      const blob = toUploadBlob(input.data, input.mimeType, filename);
      form.append("file", blob, filename);

      const res = await fetchFn(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        warn(
          `[ai-observatory] POST ${url} failed: ${res.status}${
            text ? ` ${text.slice(0, 200)}` : ""
          }`,
        );
        return null;
      }

      /** @type {import("./index.js").UploadArtifactResult} */
      const body = await res.json();
      return body;
    } catch (err) {
      warn(
        "[ai-observatory] uploadArtifact failed:",
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  /**
   * Fire-and-forget artifact upload. No-op when disabled.
   *
   * @param {string} eventId
   * @param {import("./index.js").UploadArtifactInput} input
   */
  function reportArtifact(eventId, input) {
    if (!enabled) return;
    try {
      void uploadArtifact(eventId, input);
    } catch (err) {
      warn(
        "[ai-observatory] reportArtifact failed:",
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
    uploadArtifact,
    reportArtifact,
  };
}
