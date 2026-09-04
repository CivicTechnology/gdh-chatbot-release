/**
 * Embedding Domain Types
 */

export type EmbedOptions = {
	force: boolean;
};

export type EmbedResult = {
	processed: number;
	skipped: number;
	errors: number;
};

export type ChunkToEmbed = {
	id: string;
	text: string;
};
