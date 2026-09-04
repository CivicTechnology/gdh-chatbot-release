import { createOpenAI } from "@ai-sdk/openai";
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

export const myProvider = isTestEnvironment
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
        },
      });
    })()
  : (() => {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      return customProvider({
        languageModels: {
          // Default chat model (text-only). Adjust to your preferred OpenAI model.
          "chat-model": openai.languageModel("gpt-5.2"),
          // Reasoning variant wrapped with reasoning extraction if desired.
          "chat-model-reasoning": wrapLanguageModel({
            model: openai.languageModel("gpt-5.2"),
            middleware: extractReasoningMiddleware({ tagName: "think" }),
          }),
          // Title model can reuse the same base model.
          "title-model": openai.languageModel("gpt-5.2"),
        },
      });
    })();
