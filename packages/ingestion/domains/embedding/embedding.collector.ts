/**
 * Embedding Collector
 * OpenAI API interactions for generating embeddings
 */

import { createOpenAI } from "@ai-sdk/openai";
import { createAzure } from "@ai-sdk/azure";

// Batch size for embedding API calls (OpenAI supports up to 2048)
// Using 100 as a balance between speed and memory usage
export const EMBEDDING_BATCH_SIZE = 100;

let embeddingModel: ReturnType<
  ReturnType<typeof createOpenAI | typeof createAzure>["textEmbeddingModel"]
> | null = null;

function getEmbeddingModel() {
  if (!embeddingModel) {
    if (!process.env.OPENAI_API_KEY && !process.env.AZURE_API_KEY) {
      throw new Error(
        "OPENAI_API_KEY or AZURE_API_KEY is required for embedding generation",
      );
    }

    const provider = (process.env.AI_PROVIDER ?? "azure").toLowerCase();

    switch (provider) {
      case "openai":
        const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
        embeddingModel = openai.textEmbeddingModel("text-embedding-3-small");
        break;
      case "azure":
      default:
        const azure = createAzure({
          resourceName: process.env.AZURE_RESOURCE_NAME,
          apiKey: process.env.AZURE_API_KEY,
        });
        embeddingModel = azure.textEmbeddingModel("text-embedding-3-small");
        break;
    }
  }
  return embeddingModel;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = getEmbeddingModel();
  const result = await model.doEmbed({ values: [text] });
  return result.embeddings[0];
}

/**
 * Generate embeddings for multiple texts in a single API call
 * Much faster than calling generateEmbedding for each text individually
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const model = getEmbeddingModel();
  const result = await model.doEmbed({ values: texts });
  return result.embeddings;
}

export function getModelId(): string {
  return "text-embedding-3-small";
}
