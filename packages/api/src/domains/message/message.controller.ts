import type { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "@/domains/auth/auth.types.js";
import { getChatForModification } from "@/domains/chat/chat.service.js";
import { ChatSDKError } from "@/lib/errors.js";
import { getMessageById, deleteMessagesAfterTimestamp } from "./message.service.js";

export async function deleteTrailingMessages(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const idResult = z.string().uuid().safeParse(req.params.id);

		if (!idResult.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		const id = idResult.data;

		// Get the message to find its chatId and createdAt
		const targetMessage = await getMessageById(id);

		if (!targetMessage) {
			res.status(404).json(new ChatSDKError("not_found:chat").toResponse());
			return;
		}

		// Verify user can modify this chat
		await getChatForModification(targetMessage.chatId, {
			userId: req.user?.id,
			sessionId: req.anonymousSessionId,
		});

		// Delete the message and all messages after it
		await deleteMessagesAfterTimestamp(targetMessage.chatId, targetMessage.createdAt);

		res.status(200).json({ success: true });
	} catch (error) {
		if (error instanceof ChatSDKError) {
			res.status(error.statusCode).json(error.toResponse());
			return;
		}

		console.error("Error deleting trailing messages:", error);
		res.status(500).json(new ChatSDKError("offline:chat").toResponse());
	}
}
