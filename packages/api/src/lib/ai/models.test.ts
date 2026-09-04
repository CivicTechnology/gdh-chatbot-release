import { simulateReadableStream } from "ai";
import { MockLanguageModelV2 } from "ai/test";

// Helper function to generate mock response chunks for testing
// biome-ignore lint/suspicious/noExplicitAny: Mock test data
function getResponseChunksByPrompt(_prompt: unknown, _isReasoning = false): any[] {
  return [
    { type: "text-delta", textDelta: "Hello" },
    { type: "text-delta", textDelta: ", " },
    { type: "text-delta", textDelta: "world!" },
    {
      type: "finish",
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 20 },
    },
  ];
}

export const chatModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: "text", text: "Hello, world!" }],
    warnings: [],
  }),
  doStream: async ({ prompt }) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: getResponseChunksByPrompt(prompt),
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

export const reasoningModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: "text", text: "Hello, world!" }],
    warnings: [],
  }),
  doStream: async ({ prompt }) => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: getResponseChunksByPrompt(prompt, true),
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});

export const titleModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: "stop",
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
    content: [{ type: "text", text: "This is a test title" }],
    warnings: [],
  }),
  doStream: async () => ({
    stream: simulateReadableStream({
      chunkDelayInMs: 500,
      initialDelayInMs: 1000,
      chunks: [
        { id: "1", type: "text-start" },
        { id: "1", type: "text-delta", delta: "This is a test title" },
        { id: "1", type: "text-end" },
        {
          type: "finish",
          finishReason: "stop",
          usage: { inputTokens: 3, outputTokens: 10, totalTokens: 13 },
        },
      ],
    }),
    rawCall: { rawPrompt: null, rawSettings: {} },
  }),
});
