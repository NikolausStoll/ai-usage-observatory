export const DEFAULT_EVENT_PAGE_SIZE = 100;
export const MAX_EVENT_PAGE_SIZE = 1000;

export type EventSortBy =
  | "timestamp"
  | "status"
  | "applicationName"
  | "environment"
  | "feature"
  | "operation"
  | "requestedModel"
  | "inputTokens"
  | "cachedInputTokens"
  | "outputTokens"
  | "totalCost"
  | "durationMs";

export type EventSortDir = "asc" | "desc";

export interface EventListItem {
  eventId: string;
  applicationId: string;
  applicationName: string;
  status: string;
  environment: string;
  feature: string;
  operation: string;
  provider: string;
  requestedModel: string;
  reportedModel: string | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  totalCost: string | null;
  pricingId: string | null;
  timestamp: string;
  durationMs: number;
}
