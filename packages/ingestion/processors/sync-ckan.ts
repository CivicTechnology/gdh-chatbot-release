/**
 * Syncs all CKAN datasets to PostgreSQL
 * Configuration is read from config/ckan.json
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { disconnectPrisma } from "../lib/prisma.js";
import * as ckanService from "../domains/ckan/ckan.service.js";
import type { CkanConfig } from "../domains/ckan/ckan.types.js";
import { loadEnv } from "../lib/load-env.js";

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INGESTION_ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(INGESTION_ROOT, "config", "ckan.json");

// Parse --force flag from command line arguments
const forceSync = process.argv.includes("--force") || process.argv.includes("-f");

async function loadConfig(): Promise<CkanConfig> {
	const content = await fs.readFile(CONFIG_PATH, "utf-8");
	return JSON.parse(content) as CkanConfig;
}

async function main() {
	console.log("=== CKAN Sync Started ===\n");
	if (forceSync) {
		console.log("Force mode enabled - will re-sync all datasets\n");
	}

	if (!process.env.POSTGRES_URL) {
		console.log("POSTGRES_URL not set, skipping sync");
		return;
	}

	try {
		const config = await loadConfig();
		const result = await ckanService.syncAllDatasets(config, { force: forceSync });

		console.log("\n=== Sync Complete ===");
		console.log(`Synced: ${result.synced}`);
		console.log(`Skipped: ${result.skipped}`);
		console.log(`Errors: ${result.errors}`);
		console.log(`Total: ${result.total}`);
	} finally {
		await disconnectPrisma();
	}
}

main().catch((error) => {
	console.error("Sync failed:", error);
	process.exit(1);
});
