import { z } from "zod";

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ])
);

const requestResponseSchema = z
  .object({
    input: jsonValueSchema.optional(),
    output: jsonValueSchema.optional(),
    raw: jsonValueSchema.optional(),
    metadata: z.record(jsonValueSchema).optional(),
  })
  .optional();

const usageSchema = z
  .object({
    inputTokens: z.number().int().nonnegative().nullable().optional(),
    cachedInputTokens: z.number().int().nonnegative().nullable().optional(),
    outputTokens: z.number().int().nonnegative().nullable().optional(),
    reasoningTokens: z.number().int().nonnegative().nullable().optional(),
    totalTokens: z.number().int().nonnegative().nullable().optional(),
    rawUsage: z.record(jsonValueSchema).optional(),
  })
  .optional();

const errorSchema = z
  .object({
    type: z.string().optional(),
    message: z.string().optional(),
    metadata: z.record(jsonValueSchema).optional(),
  })
  .optional();

export const IngestEventSchema = z.object({
  eventId: z
    .string()
    .regex(uuidRegex, "eventId must be a valid UUID"),
  timestamp: z.string().datetime({ message: "timestamp must be ISO8601 UTC" }),
  durationMs: z.number().int().nonnegative(),
  environment: z.string().min(1),
  applicationVersion: z.string().optional(),
  feature: z.string().min(1),
  operation: z.string().min(1),
  operationId: z.string().min(1),
  workflowId: z.string().optional(),
  /** App-defined stable identifier for the business object this AI op relates to. Opaque to Observatory. */
  subjectId: z.string().min(1).optional(),
  /** Human-readable name/title of that object at request time. Opaque to Observatory. */
  subjectLabel: z.string().min(1).optional(),
  attemptNumber: z.number().int().min(1),
  status: z.enum(["success", "error"]),
  provider: z.string().min(1),
  requestedModel: z.string().min(1),
  reportedModel: z.string().optional(),
  promptId: z.string().optional(),
  promptVersion: z.string().optional(),
  requestConfig: z.record(jsonValueSchema).optional(),
  request: requestResponseSchema,
  response: requestResponseSchema,
  usage: usageSchema,
  httpStatus: z.number().int().optional(),
  error: errorSchema,
  metadata: z.record(jsonValueSchema).optional(),
  metrics: z.record(jsonValueSchema).optional(),
});

export type IngestEvent = z.infer<typeof IngestEventSchema>;

export interface StoredEvent extends IngestEvent {
  applicationId: string;
  receivedAt: string;
}
