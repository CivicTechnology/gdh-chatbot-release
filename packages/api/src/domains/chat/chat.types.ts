import type { ChatVisibility } from "@gdh-chatbot/api/prisma";

export type VisibilityType = "public" | "private";

export interface CreateChatInput {
	id: string;
	userId: string | null;
	sessionId: string | null;
	title: string;
	visibility: VisibilityType;
}

export interface ChatAccessContext {
	userId?: string;
	sessionId?: string;
}

export interface GetChatsOptions {
	userId?: string;
	sessionId?: string;
	limit: number;
	startingAfter?: string | null;
	endingBefore?: string | null;
}
