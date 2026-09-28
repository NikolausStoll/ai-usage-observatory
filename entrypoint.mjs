/**
 * Container / Home Assistant entrypoint.
 * Reads HA options from /data/options.json (when present), maps them to env vars,
 * then starts the production server.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPTIONS_FILE = "/data/options.json";

let fileOptions = {};
if (existsSync(OPTIONS_FILE)) {
  try {
    fileOptions = JSON.parse(readFileSync(OPTIONS_FILE, "utf-8") || "{}");
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "options_parse_failed",
        message: String(error),
      })
    );
  }
}

function resolveSetting(envName, fallback, keys = []) {
  for (const key of keys) {
    if (fileOptions[key] != null && fileOptions[key] !== "") {
      return fileOptions[key];
    }
  }
  return process.env[envName] ?? fallback;
}

const port = resolveSetting("PORT", "8096", ["port"]);
const dataDir = resolveSetting("DATA_DIR", "/data", ["data_dir", "dataDir"]);
const dbPath = resolveSetting("DB_PATH", join(String(dataDir), "observatory.sqlite"), [
  "db_path",
  "dbPath",
]);
const maxEventSizeBytes = resolveSetting("MAX_EVENT_SIZE_BYTES", "1048576", [
  "max_event_size_bytes",
]);
const maxArtifactSizeBytes = resolveSetting("MAX_ARTIFACT_SIZE_BYTES", "26214400", [
  "max_artifact_size_bytes",
]);

process.env.PORT = String(port);
process.env.DATA_DIR = String(dataDir);
process.env.DB_PATH = String(dbPath);
process.env.MAX_EVENT_SIZE_BYTES = String(maxEventSizeBytes);
process.env.MAX_ARTIFACT_SIZE_BYTES = String(maxArtifactSizeBytes);
process.env.NODE_ENV = process.env.NODE_ENV ?? "production";

console.log(
  JSON.stringify({
    level: "info",
    event: "options_loaded",
    port: process.env.PORT,
    dataDir: process.env.DATA_DIR,
    dbPath: process.env.DB_PATH,
    maxEventSizeBytes: process.env.MAX_EVENT_SIZE_BYTES,
    maxArtifactSizeBytes: process.env.MAX_ARTIFACT_SIZE_BYTES,
    fromOptionsFile: existsSync(OPTIONS_FILE),
  })
);

const child = spawn(process.execPath, [join(__dirname, "start.mjs")], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "start_failed",
      message: String(err),
    })
  );
  process.exit(1);
});
