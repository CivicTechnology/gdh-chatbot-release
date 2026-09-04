export interface CreateMessageInput {
	id: string;
	chatId: string;
	role: string;
	parts: unknown;
	attachments: unknown;
	createdAt: Date;
}
