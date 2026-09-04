import * as streamRepository from "./stream.repository.js";

export function createStreamId(streamId: string, chatId: string) {
	return streamRepository.createStream(streamId, chatId);
}

export function getStreamIdsByChatId(chatId: string) {
	return streamRepository.findStreamsByChatId(chatId);
}

export function getCkanDatasetCount() {
	return streamRepository.getCkanDatasetCountFromDb();
}
