/**
 * Embedding generation script
 * Generates embeddings for document chunks using OpenAI
 */

import { disconnectPrisma } from "../lib/prisma.js";
import * as embeddingService from "../domains/embedding/embedding.service.js";
import { loadEnv } from "../lib/load-env.js";

loadEnv();

if (!process.env.OPENAI_API_KEY) {
	console.error("OPENAI_API_KEY is not defined in environment");
	process.exit(1);
}

if (!process.env.POSTGRES_URL) {
	console.error("POSTGRES_URL is not defined in environment");
	process.exit(1);
}

const forceReembed = process.argv.includes("--force");

async function main() {
	console.log("=== Embedding Generation Started ===\n");

	try {
		const result = await embeddingService.embedAllChunks({ force: forceReembed });

		console.log("\n=== Embedding Complete ===");
		console.log(`Processed: ${result.processed}`);
		console.log(`Skipped: ${result.skipped}`);
		console.log(`Errors: ${result.errors}`);
	} finally {
		await disconnectPrisma();
	}
}

main().catch((error) => {
	console.error("Embedding job failed:", error);
	process.exit(1);
});
