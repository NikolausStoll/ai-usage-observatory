import { createFileRoute } from "@tanstack/react-router";
import { handleUploadArtifact } from "../../../../../api/routes/artifacts.js";

export const Route = createFileRoute("/api/v1/events/$eventId/artifacts")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleUploadArtifact(request, params.eventId),
    },
  },
});
