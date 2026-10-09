import { apiClient } from "./client";

const BASE = "/admin/feedback";

export type FeedbackRating = "up" | "down";

/** Eén feedback-item zoals de beheerders-API het teruggeeft. */
export type AdminFeedbackItem = {
  id: string;
  chatId: string;
  messageId: string;
  isUpvoted: boolean;
  comment: string | null;
  chatShared: boolean;
  createdAt: string;
  updatedAt: string;
  /** Vraag van de gebruiker die aan het beoordeelde antwoord voorafging. */
  prompt: string | null;
  /** Tekst van het beoordeelde assistent-antwoord. */
  response: string | null;
  /** Alleen gevuld wanneer de gebruiker het gesprek deelde. */
  chatTitle: string | null;
};

export type FeedbackStats = {
  total: number;
  upCount: number;
  downCount: number;
  withComment: number;
  sharedCount: number;
};

export type FeedbackListResponse = {
  items: AdminFeedbackItem[];
  total: number;
  stats: FeedbackStats;
};

export type SharedChatMessage = {
  id: string;
  role: string;
  text: string;
  createdAt: string;
};

export type SharedChatResponse = {
  chat: {
    id: string;
    title: string;
    createdAt: string;
  };
  messages: SharedChatMessage[];
};

export const feedbackApi = {
  list(params: URLSearchParams) {
    const qs = params.toString();
    return apiClient.get<FeedbackListResponse>(qs ? `${BASE}?${qs}` : BASE);
  },
  sharedChat(feedbackId: string) {
    return apiClient.get<SharedChatResponse>(`${BASE}/${feedbackId}/chat`);
  },
};
