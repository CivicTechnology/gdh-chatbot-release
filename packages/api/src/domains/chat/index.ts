export { chatRouter } from "./chat.routes.js";
export { historyRouter } from "./history.routes.js";

// Controller exports
export { createChat, showChat, destroyChat, destroyAllChats } from "./chat.controller.js";
export { getHistory } from "./history.controller.js";

// Service exports
export {
	getChatById,
	getChatForModification,
	createNewChat,
	deleteChatById,
	deleteAllUserChats,
	getChats,
	generateTitleFromMessage,
	updateLastContext,
} from "./chat.service.js";

// Repository exports
export {
	findChatById,
	createChat as createChatInDb,
	deleteChat,
	deleteAllChatsByUserId,
	findChatsByUserId,
	findChatsBySessionId,
	updateChatVisibility,
	updateChatLastContext,
} from "./chat.repository.js";

// Type exports
export type {
	CreateChatInput,
	ChatAccessContext,
	GetChatsOptions,
	VisibilityType,
} from "./chat.types.js";
