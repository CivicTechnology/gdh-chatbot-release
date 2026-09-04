import { createOpenAI } from "@ai-sdk/openai";
import { ChatSDKError } from "../errors";
import { aiConfig, getEmbeddingModelId } from "../config/ai.js";

export const DEFAULT_EMBEDDING_MODEL_NAME = aiConfig.embedding.model;
export const DEFAULT_EMBEDDING_MODEL_ID = getEmbeddingModelId();

type TextEmbeddingModel = ReturnType<
  ReturnType<typeof createOpenAI>["textEmbeddingModel"]
>;

let cachedOpenAI: ReturnType<typeof createOpenAI> | null = null;
let cachedEmbeddingModel: TextEmbeddingModel | null = null;

export function initializeEmbeddings(openaiApiKey: string) {
  if (!openaiApiKey) {
    throw new ChatSDKError("bad_request:api", "OpenAI API key is required");
  }

  cachedOpenAI = createOpenAI({
    apiKey: openaiApiKey,
  });

  cachedEmbeddingModel = cachedOpenAI.textEmbeddingModel(
    DEFAULT_EMBEDDING_MODEL_NAME
  );
}

function getEmbeddingModel() {
  if (!cachedEmbeddingModel) {
    throw new ChatSDKError(
      "bad_request:api",
      "Embedding model not initialized. Call initializeEmbeddings first."
    );
  }
  return cachedEmbeddingModel;
}

export async function createEmbedding(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new ChatSDKError(
      "bad_request:api",
      "Cannot embed empty text for retrieval"
    );
  }

  const embeddingModel = getEmbeddingModel();
  const result = await embeddingModel.doEmbed({ values: [trimmed] });
  const [embedding] = result.embeddings;

  if (!embedding) {
    throw new ChatSDKError(
      "bad_request:api",
      "Embedding model returned no values"
    );
  }

  return embedding;
}
