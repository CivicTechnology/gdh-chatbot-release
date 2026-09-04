import type { CoreAssistantMessage, CoreToolMessage } from "ai";
import { type ClassValue, clsx } from "clsx";
import { formatISO } from "date-fns";
import { randomUUID } from "node:crypto";
import { twMerge } from "tailwind-merge";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError, type ErrorCode } from "./errors";
import type { ChatMessage } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json() as { code?: ErrorCode; cause?: string };
    throw new ChatSDKError(errorData.code as ErrorCode, errorData.cause);
  }

  return response.json();
};

export async function fetchWithErrorHandlers(
  input: string | URL,
  init?: RequestInit
) {
  try {
    const response = await fetch(input, init);

    if (!response.ok) {
      const errorData = await response.json() as { code?: ErrorCode; cause?: string };
      throw new ChatSDKError(errorData.code as ErrorCode, errorData.cause);
    }

    return response;
  } catch (error: unknown) {
    // In a server environment, we can't check navigator.onLine
    // Network errors will be thrown as fetch errors
    throw error;
  }
}

// Note: This function is not applicable in a server environment
// If you need persistent storage, use a database or Redis
export function getLocalStorage(_key: string): unknown[] {
  return [];
}

export function generateUUID(): string {
  return randomUUID();
}

type ResponseMessageWithoutId = CoreToolMessage | CoreAssistantMessage;
type ResponseMessage = ResponseMessageWithoutId & { id: string };

export function getMostRecentUserMessage(
  messages: ChatMessage[]
): ChatMessage | undefined {
  const userMessages = messages.filter((message) => message.role === "user");
  return userMessages.at(-1);
}

export function getTrailingMessageId({
  messages,
}: {
  messages: ResponseMessage[];
}): string | null {
  const trailingMessage = messages.at(-1);

  if (!trailingMessage) {
    return null;
  }

  return trailingMessage.id;
}

export function sanitizeText(text: string) {
  return text.replace("<has_function_call>", "");
}

export function convertToUIMessages(messages: DBMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    parts: message.parts as ChatMessage["parts"],
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}

export function getTextFromMessage(message: ChatMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
