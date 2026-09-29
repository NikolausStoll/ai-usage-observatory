import { describe, it, expect } from "vitest";
import { createTestDb } from "../../src/db/database.js";
import { handleHealth } from "../../src/api/routes/health.js";

describe("handleHealth", () => {
  it("returns ok when DB is ready", () => {
    const db = createTestDb();
    const result = handleHealth(db);
    expect(result.status).toBe("ok");
    expect(result.db).toBe("ready");
    expect(typeof result.migrations).toBe("number");
    expect(result.migrations).toBeGreaterThanOrEqual(1);
  });

  it("returns error when DB is closed", () => {
    const db = createTestDb();
    db.close();
    const result = handleHealth(db);
    expect(result.status).toBe("error");
    expect(result.db).toBe("unavailable");
    expect(result.message).toBeTruthy();
  });

  it("migration count reflects applied migrations", () => {
    const db = createTestDb();
    const result = handleHealth(db);
    // createTestDb applies all migrations
    expect(result.migrations).toBe(4);
  });
});
