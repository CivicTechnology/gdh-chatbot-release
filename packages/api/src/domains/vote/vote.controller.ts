import type { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "@/domains/auth/auth.types.js";
import { getChatById } from "@/domains/chat/chat.service.js";
import { getMessageById } from "@/domains/message/message.service.js";
import { ChatSDKError } from "@/lib/errors.js";
import { getVotesByChatId, voteMessage } from "./vote.service.js";

export async function getVotes(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const chatIdResult = z.string().uuid().safeParse(req.query.chatId);

		if (!chatIdResult.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		const chatId = chatIdResult.data;

		// Verify user has access to this chat
		await getChatById(chatId, {
			userId: req.user?.id,
			sessionId: req.anonymousSessionId,
		});

		const votes = await getVotesByChatId(chatId);

		res.status(200).json(votes);
	} catch (error) {
		if (error instanceof ChatSDKError) {
			res.status(error.statusCode).json(error.toResponse());
			return;
		}

		console.error("Error getting votes:", error);
		res.status(500).json(new ChatSDKError("offline:chat").toResponse());
	}
}

export async function updateVote(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const { chatId, messageId, type } = req.body;

		const chatIdResult = z.string().uuid().safeParse(chatId);
		const messageIdResult = z.string().uuid().safeParse(messageId);
		const typeResult = z.enum(["up", "down"]).safeParse(type);

		if (!chatIdResult.success || !messageIdResult.success || !typeResult.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		// Verify user has access to this chat
		await getChatById(chatIdResult.data, {
			userId: req.user?.id,
			sessionId: req.anonymousSessionId,
		});

		// Verify message exists and belongs to chat
		const message = await getMessageById(messageIdResult.data);
		if (!message || message.chatId !== chatIdResult.data) {
			res.status(404).json(new ChatSDKError("not_found:chat").toResponse());
			return;
		}

		await voteMessage(chatIdResult.data, messageIdResult.data, typeResult.data);

		res.status(200).json({ success: true });
	} catch (error) {
		if (error instanceof ChatSDKError) {
			res.status(error.statusCode).json(error.toResponse());
			return;
		}

		console.error("Error voting:", error);
		res.status(500).json(new ChatSDKError("offline:chat").toResponse());
	}
}
