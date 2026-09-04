import type { Chat } from "@gdh-chatbot/api/prisma";
import { ChatSDKError } from "@/lib/errors.js";
import * as chatRepository from "./chat.repository.js";
import type { ChatAccessContext, CreateChatInput, GetChatsOptions } from "./chat.types.js";

function canAccessChat(chat: Chat, context: ChatAccessContext): boolean {
	// Public chats are accessible to everyone
	if (chat.visibility === "public") {
		return true;
	}

	// Private chats: check ownership
	if (context.userId && chat.userId === context.userId) {
		return true;
	}

	// Anonymous chat: check session
	if (context.sessionId && chat.sessionId === context.sessionId && !chat.userId) {
		return true;
	}

	return false;
}

function canModifyChat(chat: Chat, context: ChatAccessContext): boolean {
	// Authenticated user owns the chat
	if (context.userId && chat.userId === context.userId) {
		return true;
	}

	// Anonymous user owns the chat (via session)
	if (context.sessionId && chat.sessionId === context.sessionId && !chat.userId) {
		return true;
	}

	return false;
}

export async function getChatById(id: string, context: ChatAccessContext) {
	const chat = await chatRepository.findChatById(id);

	if (!chat) {
		throw new ChatSDKError("not_found:chat", "Chat not found");
	}

	if (!canAccessChat(chat, context)) {
		throw new ChatSDKError("not_found:chat", "Chat not found");
	}

	return chat;
}

export async function getChatForModification(id: string, context: ChatAccessContext) {
	const chat = await chatRepository.findChatById(id);

	if (!chat) {
		throw new ChatSDKError("not_found:chat", "Chat not found");
	}

	if (!canModifyChat(chat, context)) {
		throw new ChatSDKError("forbidden:chat", "Not allowed to modify this chat");
	}

	return chat;
}

export async function createNewChat(input: CreateChatInput) {
	return chatRepository.createChat(input);
}

export async function deleteChatById(id: string, context: ChatAccessContext) {
	const chat = await chatRepository.findChatById(id);

	if (!chat) {
		throw new ChatSDKError("not_found:chat", "Chat not found");
	}

	if (!canModifyChat(chat, context)) {
		throw new ChatSDKError("forbidden:chat", "Not allowed to delete this chat");
	}

	return chatRepository.deleteChat(id);
}

export async function deleteAllUserChats(userId: string) {
	return chatRepository.deleteAllChatsByUserId(userId);
}

export async function getChats(options: GetChatsOptions) {
	const { userId, sessionId, limit, startingAfter, endingBefore } = options;

	let chats: Chat[];

	if (userId) {
		chats = await chatRepository.findChatsByUserId({
			userId,
			limit,
			startingAfter,
			endingBefore,
		});
	} else if (sessionId) {
		chats = await chatRepository.findChatsBySessionId({
			sessionId,
			limit,
			startingAfter,
			endingBefore,
		});
	} else {
		return { chats: [], hasMore: false };
	}

	const hasMore = chats.length > limit;

	return {
		chats: hasMore ? chats.slice(0, limit) : chats,
		hasMore,
	};
}

export function generateTitleFromMessage(message: { parts: Array<{ type: string; text?: string }> }): string {
	const textContent = message.parts
		.filter((part) => part.type === "text")
		.map((part) => part.text ?? "")
		.join(" ");

	return textContent.slice(0, 100) || "New Chat";
}

export function updateLastContext(chatId: string, context: Parameters<typeof chatRepository.updateChatLastContext>[1]) {
	return chatRepository.updateChatLastContext(chatId, context);
}
