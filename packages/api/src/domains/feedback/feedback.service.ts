import { findChatById } from "@/domains/chat/chat.repository.js";
import { findMessagesByChatId } from "@/domains/message/message.repository.js";
import { ChatSDKError } from "@/lib/errors.js";
import {
	countFeedbackStats,
	findFeedbackByChatId,
	findFeedbackById,
	findFeedbackForAdmin,
	findPrecedingUserMessage,
	upsertFeedback,
} from "./feedback.repository.js";
import type {
	AdminFeedbackItem,
	FeedbackStats,
	ListFeedbackQuery,
	SharedChatOutput,
	UpsertFeedbackInput,
} from "./feedback.types.js";

/**
 * Leesbare tekst uit de `parts`-JSON van een bericht. Tool-calls,
 * redeneringen en bijlagen blijven buiten beeld; alleen tekstdelen tellen.
 */
export function extractTextFromParts(parts: unknown): string {
	if (!Array.isArray(parts)) {
		return "";
	}

	const texts: string[] = [];
	for (const part of parts) {
		if (
			part !== null &&
			typeof part === "object" &&
			"type" in part &&
			part.type === "text" &&
			"text" in part &&
			typeof part.text === "string"
		) {
			texts.push(part.text);
		}
	}

	return texts.join("\n").trim();
}

export function getFeedbackByChatId(chatId: string) {
	return findFeedbackByChatId(chatId);
}

export function submitFeedback(input: UpsertFeedbackInput) {
	return upsertFeedback(input.chatId, input.messageId, {
		isUpvoted: input.rating === "up",
		comment: input.comment,
		chatShared: input.chatShared,
	});
}

export async function listFeedbackForAdmin(
	query: ListFeedbackQuery
): Promise<{ items: AdminFeedbackItem[]; total: number; stats: FeedbackStats }> {
	const [{ items, total }, stats] = await Promise.all([
		findFeedbackForAdmin(query),
		countFeedbackStats(),
	]);

	const enriched = await Promise.all(
		items.map(async (item): Promise<AdminFeedbackItem> => {
			const prompt = await findPrecedingUserMessage(item.chatId, item.message.createdAt);

			return {
				id: item.id,
				chatId: item.chatId,
				messageId: item.messageId,
				isUpvoted: item.isUpvoted,
				comment: item.comment,
				chatShared: item.chatShared,
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
				prompt: prompt ? extractTextFromParts(prompt.parts) : null,
				response: extractTextFromParts(item.message.parts),
				// De chattitel is afgeleid van de eerste vraag van de gebruiker en
				// dus inhoud: alleen tonen wanneer het gesprek gedeeld is.
				chatTitle: item.chatShared ? item.chat.title : null,
			};
		})
	);

	return { items: enriched, total, stats };
}

/**
 * Volledig gesprek achter een feedback-item, uitsluitend wanneer de
 * gebruiker het gesprek expliciet deelde.
 */
export async function getSharedChatForFeedback(feedbackId: string): Promise<SharedChatOutput> {
	const feedback = await findFeedbackById(feedbackId);

	if (!feedback) {
		throw new ChatSDKError("not_found:api", "Feedback niet gevonden");
	}

	if (!feedback.chatShared) {
		throw new ChatSDKError(
			"forbidden:api",
			"De gebruiker heeft dit gesprek niet gedeeld met beheerders"
		);
	}

	const chat = await findChatById(feedback.chatId);

	if (!chat) {
		throw new ChatSDKError("not_found:chat", "Chat niet gevonden");
	}

	const alleBerichten = await findMessagesByChatId(feedback.chatId);

	// De gebruiker deelde het gesprek zoals het op dat moment was. Berichten die
	// daarna nog volgen, vallen buiten die toestemming en tonen we dus niet.
	// updatedAt is het laatste moment waarop de gebruiker de feedback, en
	// daarmee de deel-keuze, bevestigde.
	const gedeeldTot = feedback.updatedAt;
	const messages = alleBerichten.filter((message) => message.createdAt <= gedeeldTot);

	return {
		chat: {
			id: chat.id,
			title: chat.title,
			createdAt: chat.createdAt,
		},
		messages: messages
			.map((message) => ({
				id: message.id,
				role: message.role,
				text: extractTextFromParts(message.parts),
				createdAt: message.createdAt,
			}))
			.filter((message) => message.text.length > 0),
	};
}
