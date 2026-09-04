import type { Prisma } from "@gdh-chatbot/api/prisma";
import { prisma } from "@/lib/db/prisma.js";
import { ChatSDKError } from "@/lib/errors.js";
import type { CreateMessageInput } from "./message.types.js";

export async function findMessageById(id: string) {
	try {
		return await prisma.message.findUnique({ where: { id } });
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to get message by id");
	}
}

export async function findMessagesByChatId(chatId: string) {
	try {
		return await prisma.message.findMany({
			where: { chatId },
			orderBy: { createdAt: "asc" },
		});
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to get messages by chat id");
	}
}

export async function createMessages(messages: CreateMessageInput[]) {
	try {
		return await prisma.message.createMany({
			data: messages as Prisma.MessageCreateManyInput[],
			skipDuplicates: true,
		});
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to save messages");
	}
}

export async function deleteMessagesAfterTimestamp(chatId: string, timestamp: Date) {
	try {
		const messagesToDelete = await prisma.message.findMany({
			where: {
				chatId,
				createdAt: { gte: timestamp },
			},
			select: { id: true },
		});

		const messageIds = messagesToDelete.map((msg) => msg.id);

		if (messageIds.length > 0) {
			await prisma.vote.deleteMany({
				where: {
					chatId,
					messageId: { in: messageIds },
				},
			});

			return await prisma.message.deleteMany({
				where: {
					chatId,
					id: { in: messageIds },
				},
			});
		}
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to delete messages after timestamp");
	}
}

export async function countMessagesByUserIdSince(userId: string, since: Date) {
	try {
		return await prisma.message.count({
			where: {
				chat: { userId },
				createdAt: { gte: since },
				role: "user",
			},
		});
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to get message count");
	}
}
