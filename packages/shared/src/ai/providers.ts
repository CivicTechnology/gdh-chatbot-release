import { createOpenAI } from "@ai-sdk/openai";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
  type Provider,
} from "ai";

type ProviderConfig = {
  openaiApiKey: string;
  isTestEnvironment?: boolean;
};

export function createMyProvider(config: ProviderConfig): Provider {
  if (config.isTestEnvironment) {
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
      },
    });
  }

  const openai = createOpenAI({
    apiKey: config.openaiApiKey,
  });

  return customProvider({
    languageModels: {
      "chat-model": openai.languageModel("gpt-5.2"),
      "chat-model-reasoning": wrapLanguageModel({
        model: openai.languageModel("gpt-5.2"),
        middleware: extractReasoningMiddleware({ tagName: "think" }),
      }),
      "title-model": openai.languageModel("gpt-5.2"),
    },
  });
}
