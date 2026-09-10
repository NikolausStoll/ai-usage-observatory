import type Database from "better-sqlite3";

export interface HealthResult {
  status: "ok" | "error";
  db: "ready" | "unavailable";
  migrations: number;
  message?: string;
}

export function handleHealth(db: Database.Database): HealthResult {
  try {
    db.prepare("SELECT 1").get();
    const row = db.prepare("SELECT COUNT(*) as cnt FROM schema_migrations").get() as { cnt: number };
    return { status: "ok", db: "ready", migrations: row.cnt };
  } catch (err) {
    return {
      status: "error",
      db: "unavailable",
      migrations: 0,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

export function handleHealthRequest(db: Database.Database): Response {
  const result = handleHealth(db);
  return new Response(JSON.stringify(result), {
    status: result.status === "ok" ? 200 : 503,
    headers: { "Content-Type": "application/json" },
  });
}
