import { createFileRoute } from "@tanstack/react-router";
import { handleServeArtifact } from "../../../../api/routes/artifacts.js";

export const Route = createFileRoute("/api/v1/artifacts/$artifactId")({
  server: {
    handlers: {
      GET: ({ request, params }) =>
        handleServeArtifact(request, params.artifactId),
    },
  },
});
