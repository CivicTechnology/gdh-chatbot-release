import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load environment variables from .env.local first, then .env.
 * In production, env vars are provided by the platform (Azure App Service)
 * and .env files are not needed.
 */
export function loadEnv(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  // Look for .env files in the monorepo root
  // lib -> ingestion -> packages -> gdh-chatbot (root)
  const rootDir = resolve(__dirname, "..", "..", "..");
  const envLocalPath = resolve(rootDir, ".env.local");
  const envPath = resolve(rootDir, ".env");

  // Development: load from .env.local first, then .env
  if (existsSync(envLocalPath)) {
    config({ path: envLocalPath });
  } else if (existsSync(envPath)) {
    config({ path: envPath });
  }
}
