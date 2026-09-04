import { formatISO } from "date-fns";
import type { GdhBericht } from "../db/schema";
import { ChatSDKError, type ErrorCode } from "../errors";

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    const data = await response.json();
    const code = typeof data === "object" && data !== null && "code" in data ? (data.code as string) : undefined;
    const cause = typeof data === "object" && data !== null && "cause" in data ? (data.cause as string) : undefined;
    throw new ChatSDKError((code ?? "unknown") as ErrorCode, cause);
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
      const data = await response.json();
      const code = typeof data === "object" && data !== null && "code" in data ? (data.code as string) : undefined;
      const cause = typeof data === "object" && data !== null && "cause" in data ? (data.cause as string) : undefined;
      throw new ChatSDKError((code ?? "unknown") as ErrorCode, cause);
    }

    return response;
  } catch (error: unknown) {
    if (typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine) {
      throw new ChatSDKError("offline:chat");
    }

    throw error;
  }
}

export function sanitizeText(text: string) {
  return text.replace("<has_function_call>", "");
}

export function convertToUIMessages(messages: GdhBericht[]) {
  return messages.map((message) => ({
    id: message.id,
    role: message.role as "user" | "assistant" | "system",
    parts: message.parts,
    metadata: {
      createdAt: formatISO(message.createdAt),
    },
  }));
}
