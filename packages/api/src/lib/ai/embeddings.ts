import { createOpenAI } from "@ai-sdk/openai";

import { ChatSDKError } from "@/lib/errors";
import {
  aiConfig,
  getEmbeddingModelId,
  retryConfig,
} from "@gdh-chatbot/shared";
import { createAzure } from "@ai-sdk/azure";

// This module is designed for server-side use only in the API package

export const DEFAULT_EMBEDDING_MODEL_NAME = aiConfig.embedding.model;
export const DEFAULT_EMBEDDING_MODEL_ID = getEmbeddingModelId();

const EMBEDDING_CONFIG = {
  ...retryConfig.embedding,
  retryableStatusCodes: retryConfig.retryableStatusCodes,
};

/**
 * Creates a fetch function with retry logic and timeout for embeddings
 */
function createEmbeddingFetchWithRetry(): typeof fetch {
  return async (input, init) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= EMBEDDING_CONFIG.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, EMBEDDING_CONFIG.timeoutMs);

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (
          EMBEDDING_CONFIG.retryableStatusCodes.includes(response.status) &&
          attempt < EMBEDDING_CONFIG.maxRetries
        ) {
          const delay = EMBEDDING_CONFIG.baseDelayMs * 2 ** attempt;
          console.warn(
            `[Embedding] Retryable status ${response.status}, attempt ${attempt + 1}/${EMBEDDING_CONFIG.maxRetries + 1}, waiting ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error instanceof Error ? error : new Error(String(error));

        if (lastError.name === "AbortError") {
          console.error(
            `[Embedding] Request timed out after ${EMBEDDING_CONFIG.timeoutMs}ms`,
          );
          throw new ChatSDKError(
            "offline:chat",
            `Embedding request timed out after ${EMBEDDING_CONFIG.timeoutMs / 1000} seconds`,
          );
        }

        // Retry on network errors
        if (
          lastError.name === "TypeError" &&
          lastError.message.includes("fetch") &&
          attempt < EMBEDDING_CONFIG.maxRetries
        ) {
          const delay = EMBEDDING_CONFIG.baseDelayMs * 2 ** attempt;
          console.warn(
            `[Embedding] Network error, attempt ${attempt + 1}/${EMBEDDING_CONFIG.maxRetries + 1}, waiting ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new Error("Max retries exceeded");
  };
}

type TextEmbeddingModel = ReturnType<
  ReturnType<typeof createOpenAI | typeof createAzure>["textEmbeddingModel"]
>;

let cachedOpenAI: ReturnType<typeof createOpenAI> | null = null;
let cachedAzure: ReturnType<typeof createAzure> | null = null;

let cachedEmbeddingModel: TextEmbeddingModel | null = null;

function getEmbeddingModel() {
  if (!process.env.OPENAI_API_KEY && !process.env.AZURE_API_KEY) {
    throw new ChatSDKError("bad_request:api");
  }

  const provider = (process.env.AI_PROVIDER ?? "azure").toLowerCase();
  let embeddingProvider;

  switch (provider) {
    case "openai":
      if (!cachedOpenAI) {
        cachedOpenAI = createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
          fetch: createEmbeddingFetchWithRetry(),
        });
      }
      embeddingProvider = cachedOpenAI;
      break;
    case "azure":
    default:
      if (!cachedAzure) {
        cachedAzure = createAzure({
          resourceName: process.env.AZURE_RESOURCE_NAME,
          apiKey: process.env.AZURE_API_KEY,
        });
      }
      embeddingProvider = cachedAzure;
      break;
  }

  if (!cachedEmbeddingModel) {
    cachedEmbeddingModel = embeddingProvider.textEmbeddingModel(
      DEFAULT_EMBEDDING_MODEL_NAME,
    );
  }

  return cachedEmbeddingModel;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ChatSDKError(
      "bad_request:api",
      "Cannot embed empty text for retrieval",
    );
  }

  const embeddingModel = getEmbeddingModel();
  const result = await embeddingModel.doEmbed({ values: [trimmed] });
  const [embedding] = result.embeddings;

  if (!embedding) {
    throw new ChatSDKError(
      "bad_request:api",
      "Embedding model returned no values",
    );
  }

  return embedding;
}
