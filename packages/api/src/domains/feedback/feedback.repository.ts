import type { Prisma } from "@gdh-chatbot/api/prisma";
import { prisma } from "@/lib/db/prisma.js";
import { ChatSDKError } from "@/lib/errors.js";
import type { ListFeedbackQuery } from "./feedback.types.js";

export async function findFeedbackByChatId(chatId: string) {
	try {
		return await prisma.messageFeedback.findMany({ where: { chatId } });
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to get feedback by chat id");
	}
}

export async function findFeedbackById(id: string) {
	try {
		return await prisma.messageFeedback.findUnique({ where: { id } });
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to get feedback by id");
	}
}

export async function upsertFeedback(
	chatId: string,
	messageId: string,
	data: {
		isUpvoted: boolean;
		comment?: string | null;
		chatShared?: boolean;
	}
) {
	try {
		return await prisma.messageFeedback.upsert({
			where: {
				MessageFeedback_chatId_messageId_unique: { chatId, messageId },
			},
			create: {
				chatId,
				messageId,
				isUpvoted: data.isUpvoted,
				comment: data.comment ?? null,
				chatShared: data.chatShared ?? false,
			},
			// `undefined` laat het bestaande veld ongemoeid, zodat een losse
			// duim-klik een eerder gegeven toelichting niet wist.
			update: {
				isUpvoted: data.isUpvoted,
				comment: data.comment,
				chatShared: data.chatShared,
			},
		});
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to save feedback");
	}
}

export async function findFeedbackForAdmin(query: ListFeedbackQuery) {
	const where: Prisma.MessageFeedbackWhereInput =
		query.rating === undefined ? {} : { isUpvoted: query.rating === "up" };

	try {
		const [items, total] = await prisma.$transaction([
			prisma.messageFeedback.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip: query.offset,
				take: query.limit,
				include: {
					message: {
						select: { id: true, chatId: true, parts: true, createdAt: true },
					},
					chat: { select: { id: true, title: true } },
				},
			}),
			prisma.messageFeedback.count({ where }),
		]);

		return { items, total };
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to list feedback");
	}
}

export async function countFeedbackStats() {
	try {
		const [total, upCount, withComment, sharedCount] = await prisma.$transaction([
			prisma.messageFeedback.count(),
			prisma.messageFeedback.count({ where: { isUpvoted: true } }),
			prisma.messageFeedback.count({ where: { NOT: { comment: null } } }),
			prisma.messageFeedback.count({ where: { chatShared: true } }),
		]);

		return { total, upCount, downCount: total - upCount, withComment, sharedCount };
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to count feedback");
	}
}

/**
 * Laatste gebruikersbericht dat aan het beoordeelde antwoord voorafging.
 * `lte` in plaats van `lt`: bij een batch-save kunnen vraag en antwoord
 * dezelfde createdAt hebben.
 */
export async function findPrecedingUserMessage(chatId: string, before: Date) {
	try {
		return await prisma.message.findFirst({
			where: {
				chatId,
				role: "user",
				createdAt: { lte: before },
			},
			orderBy: { createdAt: "desc" },
			select: { id: true, parts: true, createdAt: true },
		});
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to get preceding user message");
	}
}
