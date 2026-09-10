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
});

export const fetchEvents = createServerFn({ method: "GET" })
  .validator((input: unknown) => EventFiltersSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const db = getDb();
    return listEvents(db, data, data.page ?? 1);
  });

export const fetchEvent = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.string().parse(input))
  .handler(async ({ data: eventId }) => {
    const db = getDb();
    const event = getEvent(db, eventId);
    if (!event) return null;
    const artifacts = listArtifactsForEvent(db, eventId);
    return { event, artifacts };
  });
