import { createServerFn } from "@tanstack/react-start";
import { getDb } from "../db/database.js";
import { getDashboardStats } from "../domain/dashboard/dashboard-service.js";

export const fetchDashboardStats = createServerFn({ method: "GET" })
  .handler(async () => {
    const db = getDb();
    return getDashboardStats(db);
  });
