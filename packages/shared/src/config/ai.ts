/**
 * AI model configuration
 * Centralized settings for chat models and embedding models
 */

// ============================================================================
// Types
// ============================================================================

export type ChatModelDefinition = {
  /** Internal model ID used in the app */
  id: string;
  /** Display name shown to users */
  name: string;
  /** Description of the model's capabilities */
  description: string;
};

export type ChatConfig = {
  /** Default model ID used when no specific model is requested */
  defaultModel: string;
  /** Underlying OpenAI model ID (e.g., "gpt-4o", "gpt-5.2") */
  modelId: string;
  /** Available chat models */
  models: ChatModelDefinition[];
};

export type EmbeddingConfig = {
  /** Provider name (e.g., "openai", "cohere") */
  provider: string;
  /** Model name for the SDK (e.g., "text-embedding-3-large") */
  model: string;
};

export type AIConfig = {
  chat: ChatConfig;
  embedding: EmbeddingConfig;
};

// ============================================================================
// Configuration
// ============================================================================

export const aiConfig: AIConfig = {
  chat: {
    defaultModel: "chat-model",
    modelId: "gpt-5.2",
    models: [
      {
        id: "chat-model",
        name: "GPT-5.2",
        description: "Advanced multimodal model with vision and text capabilities",
      },
      {
        id: "chat-model-reasoning",
        name: "GPT-5.2 Reasoning",
        description: "Uses advanced chain-of-thought reasoning for complex problems",
      },
    ],
  },
  embedding: {
    provider: "openai",
    model: "text-embedding-3-small",
  },
};

// ============================================================================
// Derived values
// ============================================================================

/** Full model ID with provider prefix (for database tracking) */
export const getEmbeddingModelId = () =>
  `${aiConfig.embedding.provider}/${aiConfig.embedding.model}`;
