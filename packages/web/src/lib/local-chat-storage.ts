import type { ChatMessage } from "./types";

const CHATS_KEY = "gdh-chats";
const CHAT_PREFIX = "gdh-chat-";
const MAX_LOCAL_CHATS = 50;

export type LocalChat = {
  id: string;
  title: string;
  createdAt: string;
};

export type LocalChatData = {
  messages: ChatMessage[];
};

/**
 * Get all local chats metadata (sorted by createdAt desc)
 */
export function getLocalChats(): LocalChat[] {
  try {
    const data = localStorage.getItem(CHATS_KEY);
    if (!data) return [];
    const chats = JSON.parse(data) as LocalChat[];
    return chats.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

/**
 * Get a specific local chat with its messages
 */
export function getLocalChat(id: string): LocalChatData | null {
  try {
    const data = localStorage.getItem(`${CHAT_PREFIX}${id}`);
    if (!data) return null;
    return JSON.parse(data) as LocalChatData;
  } catch {
    return null;
  }
}

/**
 * Save a new local chat
 */
export function saveLocalChat(
  id: string,
  title: string,
  messages: ChatMessage[]
): void {
  try {
    // Get existing chats
    const chats = getLocalChats();

    // Check if chat already exists
    const existingIndex = chats.findIndex((c) => c.id === id);

    if (existingIndex === -1) {
      // New chat - add to list
      const newChat: LocalChat = {
        id,
        title,
        createdAt: new Date().toISOString(),
      };
      chats.unshift(newChat);

      // Prune old chats if over limit
      if (chats.length > MAX_LOCAL_CHATS) {
        const removedChats = chats.splice(MAX_LOCAL_CHATS);
        for (const chat of removedChats) {
          localStorage.removeItem(`${CHAT_PREFIX}${chat.id}`);
        }
      }

      localStorage.setItem(CHATS_KEY, JSON.stringify(chats));
    }

    // Save chat data
    const chatData: LocalChatData = { messages };
    localStorage.setItem(`${CHAT_PREFIX}${id}`, JSON.stringify(chatData));
  } catch (error) {
    console.warn("Failed to save local chat:", error);
  }
}

/**
 * Update messages for an existing local chat
 */
export function updateLocalChatMessages(
  id: string,
  messages: ChatMessage[]
): void {
  try {
    const chatData: LocalChatData = { messages };
    localStorage.setItem(`${CHAT_PREFIX}${id}`, JSON.stringify(chatData));
  } catch (error) {
    console.warn("Failed to update local chat messages:", error);
  }
}

/**
 * Delete a local chat
 */
export function deleteLocalChat(id: string): void {
  try {
    // Remove from chat list
    const chats = getLocalChats().filter((c) => c.id !== id);
    localStorage.setItem(CHATS_KEY, JSON.stringify(chats));

    // Remove chat data
    localStorage.removeItem(`${CHAT_PREFIX}${id}`);
  } catch (error) {
    console.warn("Failed to delete local chat:", error);
  }
}

/**
 * Clear all local chats
 */
export function clearAllLocalChats(): void {
  try {
    const chats = getLocalChats();
    for (const chat of chats) {
      localStorage.removeItem(`${CHAT_PREFIX}${chat.id}`);
    }
    localStorage.removeItem(CHATS_KEY);
  } catch (error) {
    console.warn("Failed to clear local chats:", error);
  }
}
