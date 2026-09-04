import * as voteRepository from "./vote.repository.js";

export function getVotesByChatId(chatId: string) {
	return voteRepository.findVotesByChatId(chatId);
}

export function voteMessage(chatId: string, messageId: string, type: "up" | "down") {
	return voteRepository.upsertVote(chatId, messageId, type === "up");
}
