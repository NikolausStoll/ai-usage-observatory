/**
 * Production server entry point.
 * 1. Ensures data directories exist
 * 2. Runs database migrations (before serving any traffic)
 * 3. Starts the HTTP server
 *
 * Usage: node start.mjs
 */
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env["PORT"] ?? "3000", 10);
const DATA_DIR = process.env["DATA_DIR"] ?? "./data";

if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(JSON.stringify({ level: "error", event: "config_invalid", msg: `Invalid PORT: ${process.env["PORT"]}` }));
  process.exit(1);
}
if (!DATA_DIR) {
  console.error(JSON.stringify({ level: "error", event: "config_invalid", msg: "DATA_DIR must not be empty" }));
  process.exit(1);
}

function log(obj) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj }));
}

log({ level: "info", event: "config", port: PORT, dataDir: DATA_DIR, nodeEnv: process.env["NODE_ENV"] ?? "production" });

// 1. Ensure data directories
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(join(DATA_DIR, "artifacts"), { recursive: true });
log({ level: "info", event: "data_dirs_ready", dataDir: DATA_DIR });

// 2. Run migrations explicitly before serving
const { runMigrations } = await import(join(__dirname, "scripts/run-migrations.mjs"));
runMigrations(DATA_DIR);
log({ level: "info", event: "migrations_complete" });

// 3. Start HTTP server
const { serve } = await import("srvx/node");
const { default: appServer } = await import(join(__dirname, "dist/server/server.js"));

const server = serve({
  port: PORT,
  fetch: appServer.fetch.bind(appServer),
});

await server.ready();
log({ level: "info", event: "listening", port: PORT });

let isShuttingDown = false;

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log({ level: "info", event: "shutdown_start", signal });

  server.close().then(() => {
    log({ level: "info", event: "shutdown_complete" });
    process.exit(0);
  }).catch((err) => {
    log({ level: "error", event: "shutdown_error", message: String(err) });
    process.exit(1);
  });

  // Force exit if graceful shutdown takes too long
  setTimeout(() => {
    log({ level: "warn", event: "shutdown_timeout" });
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
