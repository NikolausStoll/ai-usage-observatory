/** Token usage as accepted by POST /api/v1/events. */
export interface ObservatoryUsage {
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  totalTokens?: number | null;
  rawUsage?: Record<string, unknown>;
}

export interface ObservatoryError {
  type?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ObservatoryRequestResponse {
  input?: unknown;
  output?: unknown;
  raw?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Event payload for POST /api/v1/events.
 * @see https://github.com/NikolausStoll/ai-usage-observatory/blob/main/docs/api.md
 */
export interface ObservatoryEvent {
  eventId: string;
  timestamp: string;
  durationMs: number;
  environment: string;
  applicationVersion?: string;
  feature: string;
  operation: string;
  operationId: string;
  workflowId?: string;
  attemptNumber: number;
  status: "success" | "error";
  provider: string;
  requestedModel: string;
  reportedModel?: string;
  promptId?: string;
  promptVersion?: string;
  requestConfig?: Record<string, unknown>;
  request?: ObservatoryRequestResponse;
  response?: ObservatoryRequestResponse;
  usage?: ObservatoryUsage;
  httpStatus?: number;
  error?: ObservatoryError;
  metadata?: Record<string, unknown>;
  metrics?: Record<string, unknown>;
}

export type ObservatoryEventInput = Omit<
  ObservatoryEvent,
  "eventId" | "timestamp" | "durationMs" | "attemptNumber" | "environment"
> &
  Partial<
    Pick<
      ObservatoryEvent,
      "eventId" | "timestamp" | "durationMs" | "attemptNumber" | "environment"
    >
  >;

export interface ObservatoryClientOptions {
  /** Base URL of the Observatory (no trailing slash). Defaults to `AI_OBSERVATORY_URL`. */
  baseUrl?: string | null;
  /** Bearer API key. Defaults to `AI_OBSERVATORY_API_KEY`. */
  apiKey?: string | null;
  /** Override `fetch` (tests). */
  fetch?: typeof globalThis.fetch;
  /** Override warn logger. Defaults to `console.warn`. */
  warn?: (message: string, detail?: unknown) => void;
  /** Default `environment` when building events. Defaults to `NODE_ENV` or `production`. */
  environment?: string;
}

export interface ObservatoryClient {
  /** True when baseUrl and apiKey are both set. */
  readonly enabled: boolean;
  /** Resolved base URL (empty when disabled). */
  readonly baseUrl: string;
  /**
   * POST one event. Never throws; logs a warning on failure.
   * No-op when the client is disabled.
   */
  postEvent(event: ObservatoryEvent): Promise<void>;
  /**
   * Fire-and-forget wrapper around `postEvent`.
   * No-op when the client is disabled.
   */
  report(event: ObservatoryEvent): void;
  /**
   * Fill defaults (`eventId`, `timestamp`, `durationMs`, `attemptNumber`, `environment`)
   * then `report`. No-op when disabled.
   */
  reportEvent(partial: ObservatoryEventInput): void;
}

/** Read config from options / env and return a client. */
export function createObservatoryClient(
  options?: ObservatoryClientOptions,
): ObservatoryClient;

/**
 * Build a complete event, filling `eventId`, `timestamp`, `durationMs` (0),
 * `attemptNumber` (1), and `environment` when omitted.
 */
export function buildEvent(
  partial: ObservatoryEventInput,
  options?: Pick<ObservatoryClientOptions, "environment">,
): ObservatoryEvent;

/** `NODE_ENV` trimmed, or `production` when unset. */
export function resolveEnvironment(fallback?: string): string;
