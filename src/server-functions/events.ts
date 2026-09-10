import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getDb } from "../db/database.js";
import { listEvents, getEvent } from "../domain/events/event-service.js";
import { listArtifactsForEvent } from "../domain/artifacts/artifact-service.js";

const EventFiltersSchema = z.object({
  applicationId: z.string().optional(),
  status: z.string().optional(),
  environment: z.string().optional(),
  feature: z.string().optional(),
  provider: z.string().optional(),
  page: z.number().int().positive().optional(),
}).optional();

export const fetchEvents = createServerFn({ method: "GET", strict: false })
  .validator(EventFiltersSchema)
  .handler(async ({ data }) => {
    const db = getDb();
    const filters = data ?? {};
    return listEvents(db, filters, filters.page ?? 1);
  });

export const fetchEvent = createServerFn({ method: "GET", strict: false })
  .validator(z.string())
  .handler(async ({ data: eventId }) => {
    const db = getDb();
    const event = getEvent(db, eventId);
    if (!event) return null;
    const artifacts = listArtifactsForEvent(db, eventId);
    return { event, artifacts };
  });
