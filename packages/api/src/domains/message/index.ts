export { messageRouter } from "./message.routes.js";

// Controller exports
export { deleteTrailingMessages } from "./message.controller.js";

// Service exports
export {
	getMessageById,
	getMessagesByChatId,
	saveMessages,
	deleteMessagesAfterTimestamp,
	getMessageCountByUserId,
} from "./message.service.js";

// Repository exports
export {
	findMessageById,
	findMessagesByChatId,
	createMessages,
	deleteMessagesAfterTimestamp as deleteMessagesAfterTimestampInDb,
	countMessagesByUserIdSince,
} from "./message.repository.js";

// Type exports
export type { CreateMessageInput } from "./message.types.js";
