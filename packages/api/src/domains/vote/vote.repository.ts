import { prisma } from "@/lib/db/prisma.js";
import { ChatSDKError } from "@/lib/errors.js";

export async function findVoteByMessageId(messageId: string) {
	try {
		return await prisma.vote.findFirst({ where: { messageId } });
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to get vote");
	}
}

export async function findVotesByChatId(chatId: string) {
	try {
		return await prisma.vote.findMany({ where: { chatId } });
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to get votes by chat id");
	}
}

export async function upsertVote(chatId: string, messageId: string, isUpvoted: boolean) {
	try {
		const existing = await prisma.vote.findFirst({ where: { messageId } });

		if (existing) {
			return await prisma.vote.updateMany({
				where: { messageId, chatId },
				data: { isUpvoted },
			});
		}

		return await prisma.vote.create({
			data: { chatId, messageId, isUpvoted },
		});
	} catch {
		throw new ChatSDKError("bad_request:database", "Failed to vote message");
	}
}
