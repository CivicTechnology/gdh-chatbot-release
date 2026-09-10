import type { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "@/domains/auth/auth.types.js";
import { getChatById } from "@/domains/chat/chat.service.js";
import { getMessageById } from "@/domains/message/message.service.js";
import { ChatSDKError } from "@/lib/errors.js";
import {
	getFeedbackByChatId,
	getSharedChatForFeedback,
	listFeedbackForAdmin,
	submitFeedback,
} from "./feedback.service.js";

const MAX_COMMENT_LENGTH = 1000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const upsertFeedbackSchema = z.object({
	chatId: z.string().uuid(),
	messageId: z.string().uuid(),
	rating: z.enum(["up", "down"]),
	comment: z.string().trim().max(MAX_COMMENT_LENGTH).optional(),
	chatShared: z.boolean().optional(),
});

const listFeedbackSchema = z.object({
	rating: z.enum(["up", "down"]).optional(),
	limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
	offset: z.coerce.number().int().min(0).default(0),
});

function handleError(res: Response, error: unknown, logContext: string): void {
	if (error instanceof ChatSDKError) {
		res.status(error.statusCode).json(error.toResponse());
		return;
	}

	console.error(logContext, error);
	res.status(500).json(new ChatSDKError("offline:chat").toResponse());
}

/** GET /api/feedback?chatId= — feedback-status voor de chat-UI (duimen). */
export async function getFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const chatIdResult = z.string().uuid().safeParse(req.query.chatId);

		if (!chatIdResult.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		const chatId = chatIdResult.data;

		// Toegangscheck: alleen de eigenaar (user of anonieme sessie) mag lezen.
		await getChatById(chatId, {
			userId: req.user?.id,
			sessionId: req.anonymousSessionId,
		});

		const feedback = await getFeedbackByChatId(chatId);

		res.status(200).json(feedback);
	} catch (error) {
		handleError(res, error, "Error getting feedback:");
	}
}

/** PATCH /api/feedback — upsert van duim + optionele toelichting/deelvlag. */
export async function updateFeedback(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const parsed = upsertFeedbackSchema.safeParse(req.body);

		if (!parsed.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		const { chatId, messageId, rating, comment, chatShared } = parsed.data;

		// Toegangscheck: alleen de eigenaar mag feedback geven.
		await getChatById(chatId, {
			userId: req.user?.id,
			sessionId: req.anonymousSessionId,
		});

		const message = await getMessageById(messageId);
		if (!message || message.chatId !== chatId) {
			res.status(404).json(new ChatSDKError("not_found:chat").toResponse());
			return;
		}

		if (message.role !== "assistant") {
			res
				.status(400)
				.json(
					new ChatSDKError(
						"bad_request:api",
						"Feedback kan alleen op assistent-berichten worden gegeven"
					).toResponse()
				);
			return;
		}

		const feedback = await submitFeedback({ chatId, messageId, rating, comment, chatShared });

		res.status(200).json(feedback);
	} catch (error) {
		handleError(res, error, "Error saving feedback:");
	}
}

/** GET /api/admin/feedback — lijst + totalen voor het beheerportaal. */
export async function index(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const parsed = listFeedbackSchema.safeParse(req.query);

		if (!parsed.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		const result = await listFeedbackForAdmin(parsed.data);

		res.status(200).json(result);
	} catch (error) {
		handleError(res, error, "Error listing feedback:");
	}
}

/** GET /api/admin/feedback/:id/chat — volledig gesprek, alleen indien gedeeld. */
export async function showSharedChat(req: AuthenticatedRequest, res: Response): Promise<void> {
	try {
		const idResult = z.string().uuid().safeParse(req.params.id);

		if (!idResult.success) {
			res.status(400).json(new ChatSDKError("bad_request:api").toResponse());
			return;
		}

		const sharedChat = await getSharedChatForFeedback(idResult.data);

		res.status(200).json(sharedChat);
	} catch (error) {
		handleError(res, error, "Error getting shared chat:");
	}
}
