import * as messageRepository from "./message.repository.js";
import type { CreateMessageInput } from "./message.types.js";

export function getMessageById(id: string) {
	return messageRepository.findMessageById(id);
}

export function getMessagesByChatId(chatId: string) {
	return messageRepository.findMessagesByChatId(chatId);
}

export function saveMessages(messages: CreateMessageInput[]) {
	return messageRepository.createMessages(messages);
}

export function deleteMessagesAfterTimestamp(chatId: string, timestamp: Date) {
	return messageRepository.deleteMessagesAfterTimestamp(chatId, timestamp);
}

export async function getMessageCountByUserId(userId: string, differenceInHours: number) {
	const since = new Date(Date.now() - differenceInHours * 60 * 60 * 1000);
	const count = await messageRepository.countMessagesByUserIdSince(userId, since);
	return count ?? 0;
}
