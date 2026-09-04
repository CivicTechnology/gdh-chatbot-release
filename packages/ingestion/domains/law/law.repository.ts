/**
 * Law Repository
 * Database operations for DocumentSource and DocumentChunk
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export type DocumentSourceInput = {
	sourceId: string;
	title: string;
	url: string;
	category: string;
	tags: string[];
	description: string;
	publishedAt: Date | null;
	sha256: string;
	bytes: number;
	pageCount: number;
	manifest: Prisma.InputJsonValue;
};

export type DocumentChunkInput = {
	sourceId: string;
	chunkId: string;
	text: string;
	tokenCount: number;
	pageStart: number;
	pageEnd: number;
	chunkType: string;
	sectionPath: string[];
	isTable: boolean;
	tableId: string | null;
	viewerAnchor: string | null;
	metadata: Prisma.InputJsonValue;
	order: number;
};

export async function findHashBySourceId(sourceId: string): Promise<string | null> {
	const existing = await prisma.documentSource.findFirst({
		where: { sourceId },
		select: { sha256: true },
	});
	return existing?.sha256 ?? null;
}

export async function findSourceIdBySourceId(sourceId: string): Promise<string | null> {
	const existing = await prisma.documentSource.findFirst({
		where: { sourceId },
		select: { id: true },
	});
	return existing?.id ?? null;
}

export async function upsertSource(data: DocumentSourceInput): Promise<string> {
	const existingSource = await prisma.documentSource.findFirst({
		where: { sourceId: data.sourceId },
		select: { id: true },
	});

	if (existingSource) {
		await prisma.documentSource.update({
			where: { id: existingSource.id },
			data: {
				...data,
				updatedAt: new Date(),
			},
		});
		return existingSource.id;
	}

	const inserted = await prisma.documentSource.create({
		data: {
			...data,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		select: { id: true },
	});
	return inserted.id;
}

export async function deleteChunksBySourceId(sourceDbId: string): Promise<void> {
	await prisma.documentChunk.deleteMany({
		where: { sourceId: sourceDbId },
	});
}

export async function bulkInsertChunks(chunks: DocumentChunkInput[]): Promise<void> {
	if (chunks.length === 0) return;

	const BATCH_SIZE = 100;
	for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
		const batch = chunks.slice(i, i + BATCH_SIZE);
		await prisma.documentChunk.createMany({
			data: batch.map((chunk) => ({
				...chunk,
				createdAt: new Date(),
			})),
		});
	}
}
