import { createOpenAI } from "@ai-sdk/openai";
import { createAzure } from "@ai-sdk/azure";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { aiConfig, retryConfig, isTest } from "@gdh-chatbot/shared";

const API_CONFIG = {
  ...retryConfig.chat,
  retryableStatusCodes: retryConfig.retryableStatusCodes,
};

/**
 * Determines if an error is retryable based on status code or error type
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Network errors
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return true;
    }
    // Timeout errors should not be retried (already waited long enough)
    if (error.name === "AbortError") {
      return false;
    }
  }
  return false;
}

/**
 * Creates a fetch function with retry logic and timeout
 */
function createFetchWithRetry(): typeof fetch {
  return async (input, init) => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= API_CONFIG.maxRetries; attempt++) {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, API_CONFIG.timeoutMs);

      try {
        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Check if we should retry based on status code
        if (
          API_CONFIG.retryableStatusCodes.includes(response.status) &&
          attempt < API_CONFIG.maxRetries
        ) {
          const delay = API_CONFIG.baseDelayMs * 2 ** attempt;
          console.warn(
            `[OpenAI] Retryable status ${response.status}, attempt ${attempt + 1}/${API_CONFIG.maxRetries + 1}, waiting ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error instanceof Error ? error : new Error(String(error));

        // Handle timeout
        if (lastError.name === "AbortError") {
          console.error(
            `[OpenAI] Request timed out after ${API_CONFIG.timeoutMs}ms`,
          );
          throw new Error(
            `OpenAI API request timed out after ${API_CONFIG.timeoutMs / 1000} seconds`,
          );
        }

        // Check if error is retryable
        if (isRetryableError(error) && attempt < API_CONFIG.maxRetries) {
          const delay = API_CONFIG.baseDelayMs * 2 ** attempt;
          console.warn(
            `[OpenAI] Retryable error: ${lastError.message}, attempt ${attempt + 1}/${API_CONFIG.maxRetries + 1}, waiting ${delay}ms`,
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

export const myProvider = isTest
  ? (() => {
      const {
        chatModel,
        reasoningModel,
        titleModel,
      } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "chat-model-reasoning": reasoningModel,
          "title-model": titleModel,
          "summary-model": chatModel, // Use same mock for tests
        },
      });
    })()
  : (() => {
      const provider = (process.env.AI_PROVIDER ?? "azure").toLowerCase();
      let languageModelProvider;

      switch (provider) {
        case "openai":
          const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            fetch: createFetchWithRetry(),
          });
          languageModelProvider = openai;
          break;
        case "azure":
        default:
          const azure = createAzure({
            resourceName: process.env.AZURE_RESOURCE_NAME,
            apiKey: process.env.AZURE_API_KEY,
            fetch: createFetchWithRetry(),
          });
          languageModelProvider = azure;
          break;
      }

      const modelId = aiConfig.chat.modelId;

      return customProvider({
        languageModels: {
          "chat-model": languageModelProvider.languageModel(modelId),
          "chat-model-reasoning": wrapLanguageModel({
            model: languageModelProvider.languageModel(modelId),
            middleware: extractReasoningMiddleware({ tagName: "think" }),
          }),
          "title-model": languageModelProvider.languageModel(modelId),
          "summary-model": languageModelProvider.languageModel("gpt-4.1-mini"), // Fast model for tool summaries
        },
      });
    })();
