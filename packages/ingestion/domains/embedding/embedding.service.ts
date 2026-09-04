/**
 * Embedding Service
 * Business logic for generating embeddings
 */

import { DEFAULT_EMBEDDING_MODEL_ID } from "@gdh-chatbot/shared/ai";
import {
	EMBEDDING_BATCH_SIZE,
	generateEmbeddings,
} from "./embedding.collector.js";
import * as embeddingRepository from "./embedding.repository.js";
import type { EmbedOptions, EmbedResult } from "./embedding.types.js";

async function determineReembedStrategy(forceReembed: boolean): Promise<boolean> {
	const existingModels = await embeddingRepository.getDistinctModels();

	const hasOldModelEmbeddings = existingModels.some(
		(model) => model !== DEFAULT_EMBEDDING_MODEL_ID,
	);

	let shouldReembedAll = forceReembed;

	if (hasOldModelEmbeddings && !forceReembed) {
		console.log(`Found embeddings from different model(s): ${existingModels.join(", ")}`);
		console.log(
			`Current model is ${DEFAULT_EMBEDDING_MODEL_ID}, will re-embed all chunks...`,
		);
		shouldReembedAll = true;
	}

	return shouldReembedAll;
}

export async function embedAllChunks(options: EmbedOptions): Promise<EmbedResult> {
	const chunkCount = await embeddingRepository.getTotalChunkCount();
	console.log(`Found ${chunkCount} total chunks in database`);

	const shouldReembedAll = await determineReembedStrategy(options.force);

	if (shouldReembedAll) {
		const reason = options.force ? "Force mode" : "Model changed";
		console.log(`${reason}: Removing ALL existing embeddings...`);
		await embeddingRepository.deleteAll();
	} else {
		console.log("Incremental mode: Only embedding chunks without embeddings");
	}

	const chunks = await embeddingRepository.findChunksNeedingEmbedding(
		DEFAULT_EMBEDDING_MODEL_ID,
		shouldReembedAll,
	);

	if (chunks.length === 0) {
		console.log("All chunks already have embeddings, nothing to do!");
		return { processed: 0, skipped: chunkCount, errors: 0 };
	}

	console.log(`Starting to embed ${chunks.length} chunks (batch size: ${EMBEDDING_BATCH_SIZE})...`);
	if (!shouldReembedAll && chunks.length < chunkCount) {
		console.log(
			`   Skipping ${chunkCount - chunks.length} chunks that already have embeddings`,
		);
	}

	const start = Date.now();
	let successCount = 0;
	let errorCount = 0;

	// Process chunks in batches
	for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
		const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
		const texts = batch.map((chunk) => chunk.text);

		try {
			const embeddings = await generateEmbeddings(texts);

			const rows = batch.map((chunk, index) => ({
				chunkId: chunk.id,
				embeddingModel: DEFAULT_EMBEDDING_MODEL_ID,
				embeddedAt: new Date(),
				embedding: embeddings[index],
			}));

			await embeddingRepository.bulkInsertWithVector(rows);
			successCount += batch.length;
		} catch (error) {
			console.error(`Failed embedding batch starting at ${i}:`, error);
			errorCount += batch.length;
		}

		const processed = Math.min(i + EMBEDDING_BATCH_SIZE, chunks.length);
		const elapsed = ((Date.now() - start) / 1000).toFixed(1);
		const rate = (processed / Number.parseFloat(elapsed)).toFixed(1);
		console.log(`   processed ${processed}/${chunks.length} (${rate} chunks/s)`);
	}

	const duration = ((Date.now() - start) / 1000).toFixed(1);
	const rate = (successCount / Number.parseFloat(duration)).toFixed(1);
	console.log(
		`Embeddings completed: ${successCount} chunks in ${duration}s (${rate} chunks/s)`,
	);

	return {
		processed: successCount,
		skipped: chunkCount - chunks.length,
		errors: errorCount,
	};
}
