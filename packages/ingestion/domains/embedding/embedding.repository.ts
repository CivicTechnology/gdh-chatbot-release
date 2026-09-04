/**
 * Embedding Repository
 * Database operations for DocumentEmbedding
 */

import { Prisma } from "@gdh-chatbot/api/prisma";
import { prisma } from "../../lib/prisma.js";
import type { ChunkToEmbed } from "./embedding.types.js";

export async function getDistinctModels(): Promise<string[]> {
	const results = await prisma.documentEmbedding.findMany({
		distinct: ["embeddingModel"],
		select: { embeddingModel: true },
	});
	return results.map((r) => r.embeddingModel);
}

export async function deleteAll(): Promise<void> {
	await prisma.documentEmbedding.deleteMany();
}

export async function findChunksNeedingEmbedding(
	modelId: string,
	shouldReembedAll: boolean,
): Promise<ChunkToEmbed[]> {
	const chunks = await prisma.$queryRaw<ChunkToEmbed[]>`
    SELECT
      dc.id,
      dc.text
    FROM "DocumentChunk" dc
    INNER JOIN "DocumentSource" ds ON dc."sourceId" = ds.id
    LEFT JOIN "DocumentEmbedding" de
      ON dc.id = de."chunkId" AND de."embeddingModel" = ${modelId}
    WHERE ${shouldReembedAll ? Prisma.sql`true` : Prisma.sql`de.id IS NULL`}
    ORDER BY ds."sourceId", dc."order"
  `;

	return chunks;
}

export async function bulkInsertWithVector(
	rows: Array<{
		chunkId: string;
		embeddingModel: string;
		embeddedAt: Date;
		embedding: number[];
	}>,
): Promise<void> {
	if (rows.length === 0) return;

	const values = rows.map((row) => {
		const vectorLiteral = `[${row.embedding.join(",")}]`;
		return Prisma.sql`(gen_random_uuid(), ${row.chunkId}, ${row.embeddingModel}, ${row.embeddedAt}, ${vectorLiteral}::vector)`;
	});

	await prisma.$executeRaw`
    INSERT INTO "DocumentEmbedding" (id, "chunkId", "embeddingModel", "embeddedAt", embedding)
    VALUES ${Prisma.join(values)}
  `;
}

export async function getTotalChunkCount(): Promise<number> {
	return prisma.documentChunk.count();
}
