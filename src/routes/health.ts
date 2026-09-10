import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "../db/database.js";
import { handleHealthRequest } from "../api/routes/health.js";

export const Route = createFileRoute("/health")({
  server: {
    handlers: {
      GET: () => handleHealthRequest(getDb()),
    },
  },
});
