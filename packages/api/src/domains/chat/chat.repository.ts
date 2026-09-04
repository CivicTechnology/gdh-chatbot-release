import { prisma } from "@/lib/db/prisma.js";
import { ChatSDKError } from "@/lib/errors.js";
import type { AppUsage } from "@/lib/usage.js";
import type { CreateChatInput, VisibilityType } from "./chat.types.js";

export async function findChatById(id: string) {
	try {
		return await prisma.chat.findUnique({ where: { id } });
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
	}
}

export async function createChat(data: CreateChatInput) {
	try {
		return await prisma.chat.create({
			data: {
				id: data.id,
				createdAt: new Date(),
				userId: data.userId,
				sessionId: data.sessionId,
				title: data.title,
				visibility: data.visibility,
			},
		});
	} catch (error) {
		console.error("Failed to save chat", error);
		throw new ChatSDKError("bad_request:database", "Failed to save chat");
	}
}

export async function deleteChat(id: string) {
	try {
		return await prisma.chat.delete({ where: { id } });
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to delete chat by id");
	}
}

export async function deleteAllChatsByUserId(userId: string) {
	try {
		return await prisma.chat.deleteMany({ where: { userId } });
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to delete all chats by user id");
	}
}

export async function findChatsByUserId(options: {
	userId: string;
	limit: number;
	startingAfter?: string | null;
	endingBefore?: string | null;
}) {
	try {
		const extendedLimit = options.limit + 1;

		if (options.startingAfter) {
			const selectedChat = await prisma.chat.findUnique({
				where: { id: options.startingAfter },
			});

			if (!selectedChat) {
				throw new ChatSDKError(
					"not_found:database",
					`Chat with id ${options.startingAfter} not found`,
				);
			}

			return prisma.chat.findMany({
				where: {
					userId: options.userId,
					createdAt: { gt: selectedChat.createdAt },
				},
				orderBy: { createdAt: "desc" },
				take: extendedLimit,
			});
		}

		if (options.endingBefore) {
			const selectedChat = await prisma.chat.findUnique({
				where: { id: options.endingBefore },
			});

			if (!selectedChat) {
				throw new ChatSDKError(
					"not_found:database",
					`Chat with id ${options.endingBefore} not found`,
				);
			}

			return prisma.chat.findMany({
				where: {
					userId: options.userId,
					createdAt: { lt: selectedChat.createdAt },
				},
				orderBy: { createdAt: "desc" },
				take: extendedLimit,
			});
		}

		return prisma.chat.findMany({
			where: { userId: options.userId },
			orderBy: { createdAt: "desc" },
			take: extendedLimit,
		});
	} catch (error) {
		if (error instanceof ChatSDKError) throw error;
		throw new ChatSDKError("bad_request:database", "Failed to get chats by user id");
	}
}

export async function findChatsBySessionId(options: {
	sessionId: string;
	limit: number;
	startingAfter?: string | null;
	endingBefore?: string | null;
}) {
	try {
		const extendedLimit = options.limit + 1;

		if (options.startingAfter) {
			const selectedChat = await prisma.chat.findUnique({
				where: { id: options.startingAfter },
			});

			if (!selectedChat) {
				throw new ChatSDKError(
					"not_found:database",
					`Chat with id ${options.startingAfter} not found`,
				);
			}

			return prisma.chat.findMany({
				where: {
					sessionId: options.sessionId,
					userId: null,
					createdAt: { gt: selectedChat.createdAt },
				},
				orderBy: { createdAt: "desc" },
				take: extendedLimit,
			});
		}

		if (options.endingBefore) {
			const selectedChat = await prisma.chat.findUnique({
				where: { id: options.endingBefore },
			});

			if (!selectedChat) {
				throw new ChatSDKError(
					"not_found:database",
					`Chat with id ${options.endingBefore} not found`,
				);
			}

			return prisma.chat.findMany({
				where: {
					sessionId: options.sessionId,
					userId: null,
					createdAt: { lt: selectedChat.createdAt },
				},
				orderBy: { createdAt: "desc" },
				take: extendedLimit,
			});
		}

		return prisma.chat.findMany({
			where: { sessionId: options.sessionId, userId: null },
			orderBy: { createdAt: "desc" },
			take: extendedLimit,
		});
	} catch (error) {
		if (error instanceof ChatSDKError) throw error;
		throw new ChatSDKError("bad_request:database", "Failed to get chats by session id");
	}
}

export async function updateChatVisibility(chatId: string, visibility: VisibilityType) {
	try {
		return await prisma.chat.update({
			where: { id: chatId },
			data: { visibility },
		});
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to update chat visibility");
	}
}

export async function updateChatLastContext(chatId: string, context: AppUsage) {
	try {
		return await prisma.chat.update({
			where: { id: chatId },
			data: { lastContext: context },
		});
	} catch (error) {
		console.warn("Failed to update lastContext for chat", chatId, error);
		return;
	}
}
