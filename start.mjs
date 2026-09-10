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

function log(obj) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj }));
}

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
log({ level: "info", event: "listening", port: PORT, dataDir: DATA_DIR, nodeEnv: process.env["NODE_ENV"] ?? "production" });
