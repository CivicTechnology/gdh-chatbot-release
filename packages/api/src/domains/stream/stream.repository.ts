import { prisma } from "@/lib/db/prisma.js";
import { ChatSDKError } from "@/lib/errors.js";

// Cache for dataset count
let cachedDatasetCount: number | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function createStream(streamId: string, chatId: string) {
	try {
		return await prisma.stream.create({
			data: { id: streamId, chatId, createdAt: new Date() },
		});
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to create stream id");
	}
}

export async function findStreamsByChatId(chatId: string) {
	try {
		const streams = await prisma.stream.findMany({
			where: { chatId },
			orderBy: { createdAt: "asc" },
			select: { id: true },
		});
		return streams.map(({ id }) => id);
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to get stream ids by chat id");
	}
}

export async function getCkanDatasetCountFromDb(): Promise<number> {
	const now = Date.now();
	if (cachedDatasetCount !== null && now - cacheTimestamp < CACHE_TTL_MS) {
		return cachedDatasetCount;
	}

	try {
		const count = await prisma.ckanDataset.count();
		cachedDatasetCount = count;
		cacheTimestamp = now;
		return count;
	} catch {
		return cachedDatasetCount ?? 0;
	}
}
