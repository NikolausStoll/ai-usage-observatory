import { createFileRoute } from "@tanstack/react-router";
import { handleIngestEvent } from "../../../api/routes/events.js";

export const Route = createFileRoute("/api/v1/events")({
  server: {
    handlers: {
      POST: ({ request }) => handleIngestEvent(request),
    },
  },
});
