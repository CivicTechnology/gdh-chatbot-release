import { aiConfig, type ChatModelDefinition } from "../config/ai.js";

export const DEFAULT_CHAT_MODEL = aiConfig.chat.defaultModel;

export type ChatModel = ChatModelDefinition;

export const chatModels: ChatModel[] = [...aiConfig.chat.models];
