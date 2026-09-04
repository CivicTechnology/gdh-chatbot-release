import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { type ApiResponse, apiClient } from "./client";

export type ChatData = {
  id: string;
  userId: string | null;
  title: string;
  visibility: "public" | "private";
  lastContext?: AppUsage;
  createdAt: string;
  updatedAt: string;
};

export type ChatWithMessages = {
  chat: ChatData;
  messages: ChatMessage[];
};

export const chatApi = {
  /**
   * Get a chat by ID with its messages
   */
  async getChatById(id: string): Promise<ApiResponse<ChatWithMessages>> {
    return apiClient.get<ChatWithMessages>(`/chat/${id}`);
  },

  /**
   * Delete a chat
   */
  async deleteChat(id: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/chat/${id}`);
  },

  /**
   * Delete all chats for the authenticated user
   */
  async deleteAllChats(): Promise<ApiResponse<{ deletedCount: number }>> {
    return apiClient.delete<{ deletedCount: number }>("/chat/all");
  },

  /**
   * Get chat history
   */
  async getHistory(
    limit = 10,
    startingAfter?: string
  ): Promise<ApiResponse<{ chats: ChatData[]; hasMore: boolean }>> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (startingAfter) {
      params.set("starting_after", startingAfter);
    }
    return apiClient.get(`/history?${params.toString()}`);
  },

  /**
   * Update chat visibility
   */
  async updateVisibility(
    chatId: string,
    visibility: "public" | "private"
  ): Promise<ApiResponse<void>> {
    return apiClient.patch<void>(`/chat/${chatId}/visibility`, { visibility });
  },

  /**
   * Delete trailing messages after a specific message
   */
  async deleteTrailingMessages(messageId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/messages/${messageId}/trailing`);
  },

  /**
   * Vote on a message
   */
  async vote(
    chatId: string,
    messageId: string,
    isUpvoted: boolean
  ): Promise<ApiResponse<void>> {
    return apiClient.patch<void>("/vote", { chatId, messageId, isUpvoted });
  },

  /**
   * Get vote for a message
   */
  async getVote(
    chatId: string,
    messageId: string
  ): Promise<ApiResponse<{ isUpvoted: boolean | null }>> {
    return apiClient.get(`/vote?chatId=${chatId}&messageId=${messageId}`);
  },
};
