import { initDb } from "../src/db/database.js";
import { createApplication } from "../src/domain/applications/application-service.js";
import { createApiKey } from "../src/domain/applications/application-service.js";
import { generateApiKey, hashApiKey } from "../src/domain/auth/auth.js";

const db = initDb();

const appId = process.argv[2] ?? "recipe-app";
const appName = process.argv[3] ?? "Recipe App";
const keyName = process.argv[4] ?? "default";

// Create or skip if application already exists
const existing = db
  .prepare("SELECT id FROM applications WHERE id = ?")
  .get(appId);

if (!existing) {
  createApplication(db, appId, appName);
  console.log(`Created application: ${appId} (${appName})`);
} else {
  console.log(`Application already exists: ${appId}`);
}

const rawKey = generateApiKey();
const keyHash = hashApiKey(rawKey);
const apiKey = createApiKey(db, appId, keyName, keyHash);

console.log(`Created API key: ${apiKey.id} (${keyName})`);
console.log(`\nAPI Key (save this - shown only once):`);
console.log(rawKey);
