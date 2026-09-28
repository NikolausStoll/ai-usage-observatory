#!/usr/bin/env node
/**
 * Ensures release identifiers stay aligned.
 * Home Assistant pulls: ghcr.io/.../ai-usage-observatory:<config.yaml version>
 * So package.json must match ai-usage-observatory/config.yaml.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function configVersion() {
  const raw = readFileSync(join(root, "ai-usage-observatory/config.yaml"), "utf-8");
  const match = raw.match(/^version:\s*"([^"]+)"/m);
  if (!match) {
    throw new Error("Could not parse version from ai-usage-observatory/config.yaml");
  }
  return match[1];
}

function packageVersion() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
  if (!pkg.version) {
    throw new Error("package.json is missing version");
  }
  return pkg.version;
}

const addon = configVersion();
const npm = packageVersion();

if (addon !== npm) {
  console.error(
    `Version mismatch: ai-usage-observatory/config.yaml=${addon} package.json=${npm}`
  );
  console.error(
    "Home Assistant installs ghcr.io/nikolausstoll/ai-usage-observatory:<config version>."
  );
  console.error("Bump both to the same value in the release commit.");
  process.exit(1);
}

console.log(`Version sync OK: ${addon}`);
