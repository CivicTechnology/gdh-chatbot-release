import type { Response } from "express";
import type { AuthenticatedRequest } from "@/domains/auth/auth.types.js";
import { getChats } from "./chat.service.js";

const DEFAULT_PAGE_SIZE = 10;

export async function getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const limit = Number(req.query.limit) || DEFAULT_PAGE_SIZE;
		const startingAfter = req.query.starting_after as string | undefined;
		const endingBefore = req.query.ending_before as string | undefined;

		const { chats, hasMore } = await getChats({
			userId: req.user?.id,
			sessionId: req.anonymousSessionId,
			limit,
			startingAfter: startingAfter || null,
			endingBefore: endingBefore || null,
		});

		res.status(200).json({ chats, hasMore });
	} catch (error) {
		console.error("Error getting history:", error);
		res.status(500).json({ error: "Failed to get chat history" });
	}
}
