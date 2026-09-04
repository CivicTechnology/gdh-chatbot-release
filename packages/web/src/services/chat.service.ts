/**
 * Chat Service
 * Business logic for chat loading and access control
 */

import type { User } from "@/api/auth";
import { type ChatData, chatApi } from "@/api/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLocalChat } from "@/lib/local-chat-storage";
import type { ChatMessage } from "@/lib/types";

export type LoadChatContext = {
  userId?: string;
  isAnonymous: boolean;
};

export type LoadChatResult =
  | { success: true; chat: ChatData; messages: ChatMessage[]; modelId: string }
  | { success: false; notFound: true };

export async function loadChat(
  chatId: string,
  context: LoadChatContext
): Promise<LoadChatResult> {
  // Always try the API first — it's the source of truth for chat metadata
  const response = await chatApi.getChatById(chatId);

  if (response.data && !response.error) {
    const { chat: chatData, messages: chatMessages } = response.data;
    return {
      success: true,
      chat: chatData,
      messages: chatMessages,
      modelId: getSelectedModel(),
    };
  }

  // For anonymous users, fall back to localStorage when the API is unavailable
  if (context.isAnonymous) {
    const localChatData = getLocalChat(chatId);
    if (localChatData) {
      const now = new Date().toISOString();
      return {
        success: true,
        chat: {
          id: chatId,
          title: "Local Chat",
          createdAt: now,
          updatedAt: now,
          userId: "",
          visibility: "private",
          lastContext: undefined,
        },
        messages: localChatData.messages,
        modelId: getSelectedModel(),
      };
    }
  }

  return { success: false, notFound: true };
}

export function isReadonly(
  chat: ChatData,
  user: User | null,
  isAnonymous: boolean
): boolean {
  if (isAnonymous) {
    // Anonymous chats have empty/null userId, so they're editable
    // Server returns null, localStorage sets empty string
    return !!chat.userId;
  }

  // Authenticated users can edit their own server chats
  return user?.id !== chat.userId;
}

export function getSelectedModel(): string {
  const cookies = document.cookie.split(";");
  const chatModelCookie = cookies.find((cookie) =>
    cookie.trim().startsWith("chat-model=")
  );

  if (chatModelCookie) {
    const value = chatModelCookie.split("=")[1];
    if (value) {
      return value;
    }
  }

  return DEFAULT_CHAT_MODEL;
}
