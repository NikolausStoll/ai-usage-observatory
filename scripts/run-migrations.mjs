/**
 * Standalone migration runner — plain JS, no build step required.
 * Reads migrations from dist/server/assets/migrations/ (copied there by postbuild).
 */
import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(dataDir) {
  const dbPath = join(dataDir, "observatory.sqlite");
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(join(dataDir, "artifacts"), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  // Read from dist/server/assets/migrations/ (copied by postbuild script)
  const migrationsDir = join(__dirname, "../dist/server/assets/migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split("_")[0], 10);
    const existing = db
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(version);

    if (!existing) {
      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      db.exec(sql);
      db.prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
      ).run(version, new Date().toISOString());
      console.log(JSON.stringify({ level: "info", event: "migration_applied", file }));
    }
  }

  db.close();
}
