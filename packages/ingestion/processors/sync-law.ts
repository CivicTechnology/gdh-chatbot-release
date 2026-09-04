/**
 * Import script for Dutch Law
 * Configuration is read from config/law.json
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { disconnectPrisma } from "../lib/prisma.js";
import * as lawService from "../domains/law/law.service.js";
import type { LawConfig } from "../domains/law/law.types.js";
import { loadEnv } from "../lib/load-env.js";

loadEnv();

if (!process.env.POSTGRES_URL) {
	console.error("POSTGRES_URL is not defined in environment");
	process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INGESTION_ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(INGESTION_ROOT, "config", "law.json");

const args = process.argv.slice(2);
const forceReimport = args.includes("--force");

async function loadConfig(): Promise<LawConfig> {
	const content = await fs.readFile(CONFIG_PATH, "utf-8");
	return JSON.parse(content) as LawConfig;
}

async function main() {
	try {
		const config = await loadConfig();
		const result = await lawService.syncAllLawSources(config, { force: forceReimport });

		console.log("\n=== Import Summary ===");
		console.log(`Imported: ${result.imported}`);
		console.log(`Skipped: ${result.skipped}`);
		console.log(`Errors: ${result.errors}`);
		console.log(`Total: ${result.total}`);
	} finally {
		await disconnectPrisma();
	}
}

main().catch((error) => {
	console.error("Import failed:", error);
	process.exit(1);
});
