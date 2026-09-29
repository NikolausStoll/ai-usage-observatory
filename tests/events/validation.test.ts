import { describe, it, expect } from "vitest";
import { IngestEventSchema } from "../../src/domain/events/event-schema.js";
import { validEvent } from "../helpers.js";

describe("event payload validation", () => {
  describe("required fields", () => {
    const requiredFields = [
      "eventId",
      "timestamp",
      "durationMs",
      "environment",
      "feature",
      "operation",
      "operationId",
      "attemptNumber",
      "status",
      "provider",
      "requestedModel",
    ] as const;

    for (const field of requiredFields) {
      it(`rejects missing ${field}`, () => {
        const { [field]: _, ...rest } = validEvent;
        const result = IngestEventSchema.safeParse(rest);
        expect(result.success).toBe(false);
      });
    }
  });

  describe("UUID validation", () => {
    it("rejects non-UUID eventId", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, eventId: "not-uuid" }).success).toBe(false);
    });

    it("accepts valid UUID v7", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, eventId: "0199c9f2-9f16-7abc-8def-000000000099" }).success).toBe(true);
    });
  });

  describe("timestamp validation", () => {
    it("rejects date-only string", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, timestamp: "2026-09-09" }).success).toBe(false);
    });

    it("rejects empty string", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, timestamp: "" }).success).toBe(false);
    });

    it("rejects non-ISO format", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, timestamp: "September 9, 2026" }).success).toBe(false);
    });

    it("accepts ISO8601 UTC datetime", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, timestamp: "2026-09-09T00:00:00.000Z" }).success).toBe(true);
    });
  });

  describe("numeric field validation", () => {
    it("rejects negative durationMs", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, durationMs: -1 }).success).toBe(false);
    });

    it("accepts durationMs = 0", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, durationMs: 0 }).success).toBe(true);
    });

    it("rejects attemptNumber = 0", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, attemptNumber: 0 }).success).toBe(false);
    });

    it("rejects attemptNumber = -1", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, attemptNumber: -1 }).success).toBe(false);
    });

    it("accepts attemptNumber = 1", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, attemptNumber: 1 }).success).toBe(true);
    });
  });

  describe("status enum validation", () => {
    it("rejects unknown status", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, status: "pending" }).success).toBe(false);
      expect(IngestEventSchema.safeParse({ ...validEvent, status: "failed" }).success).toBe(false);
    });

    it("accepts 'success'", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, status: "success" }).success).toBe(true);
    });

    it("accepts 'error'", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, status: "error" }).success).toBe(true);
    });
  });

  describe("token count validation", () => {
    it("rejects negative inputTokens", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, usage: { ...validEvent.usage, inputTokens: -1 } }).success).toBe(false);
    });

    it("rejects negative outputTokens", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, usage: { ...validEvent.usage, outputTokens: -1 } }).success).toBe(false);
    });

    it("rejects negative cachedInputTokens", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, usage: { ...validEvent.usage, cachedInputTokens: -1 } }).success).toBe(false);
    });

    it("accepts null token values", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, usage: { inputTokens: null, outputTokens: null } }).success).toBe(true);
    });

    it("accepts zero token values", () => {
      expect(IngestEventSchema.safeParse({ ...validEvent, usage: { ...validEvent.usage, inputTokens: 0 } }).success).toBe(true);
    });
  });

  describe("extensible JSON fields", () => {
    it("accepts arbitrary metadata", () => {
      const result = IngestEventSchema.safeParse({
        ...validEvent,
        metadata: { nested: { deep: [1, 2, 3] }, nullVal: null, str: "ok" },
      });
      expect(result.success).toBe(true);
    });

    it("accepts arbitrary metrics", () => {
      const result = IngestEventSchema.safeParse({
        ...validEvent,
        metrics: { confidence: 0.99, count: 100, flag: true },
      });
      expect(result.success).toBe(true);
    });

    it("accepts complex request/response", () => {
      const result = IngestEventSchema.safeParse({
        ...validEvent,
        request: { input: [{ role: "user", content: "hello" }], raw: { model: "gpt-4" } },
        response: { output: "just a string output" },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("subject context", () => {
    it("accepts optional subjectId and subjectLabel", () => {
      const result = IngestEventSchema.safeParse({
        ...validEvent,
        subjectId: "recipe:123",
        subjectLabel: "Kartoffelauflauf mit Paprika",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subjectId).toBe("recipe:123");
        expect(result.data.subjectLabel).toBe("Kartoffelauflauf mit Paprika");
      }
    });

    it("accepts events without subject fields (historical / omitted)", () => {
      const result = IngestEventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subjectId).toBeUndefined();
        expect(result.data.subjectLabel).toBeUndefined();
      }
    });

    it("rejects empty subjectId", () => {
      expect(
        IngestEventSchema.safeParse({ ...validEvent, subjectId: "" }).success
      ).toBe(false);
    });

    it("rejects empty subjectLabel", () => {
      expect(
        IngestEventSchema.safeParse({ ...validEvent, subjectLabel: "" }).success
      ).toBe(false);
    });

    it("does not require subjectId when subjectLabel is set", () => {
      expect(
        IngestEventSchema.safeParse({
          ...validEvent,
          subjectLabel: "Project Hail Mary",
        }).success
      ).toBe(true);
    });
  });
});
