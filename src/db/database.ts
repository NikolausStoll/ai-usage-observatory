import Database from "better-sqlite3";
import { readFileSync, readdirSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let _db: Database.Database | null = null;

export function getDataDir(): string {
  return process.env["DATA_DIR"] ?? "./data";
}

export function getDbPath(): string {
  if (process.env["DB_PATH"]) {
    return process.env["DB_PATH"];
  }
  return join(getDataDir(), "observatory.sqlite");
}

export function getDb(): Database.Database {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}

export function initDb(dbPath?: string): Database.Database {
  const dataDir = getDataDir();
  const resolvedPath = dbPath ?? getDbPath();

  mkdirSync(dirname(resolvedPath), { recursive: true });
  mkdirSync(join(dataDir, "artifacts"), { recursive: true });

  const db = new Database(resolvedPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);
  _db = db;
  return db;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const migrationsDir = join(__dirname, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split("_")[0]!, 10);
    const existing = db
      .prepare("SELECT version FROM schema_migrations WHERE version = ?")
      .get(version);

    if (!existing) {
      const sql = readFileSync(join(migrationsDir, file), "utf-8");
      db.exec(sql);
      db
        .prepare(
          "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
        )
        .run(version, new Date().toISOString());
      console.log(`Applied migration: ${file}`);
    }
  }
}

export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  // Create migration tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const migrationsDir = join(__dirname, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    const version = parseInt(file.split("_")[0]!, 10);
    db.exec(sql);
    db.prepare(
      "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)"
    ).run(version, new Date().toISOString());
  }
  return db;
}
