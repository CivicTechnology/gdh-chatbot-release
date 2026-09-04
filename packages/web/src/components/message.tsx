import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import {
  type Dispatch,
  memo,
  type SetStateAction,
  useMemo,
  useState,
} from "react";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, sanitizeText } from "@/lib/utils";

type MessagePart = NonNullable<ChatMessage["parts"]>[number];

import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { ToolsSection } from "./tool-status";

type RenderMessagePartParams = {
  part: MessagePart;
  key: string;
  mode: "view" | "edit";
  message: ChatMessage;
  isLoading: boolean;
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  setMode: Dispatch<SetStateAction<"view" | "edit">>;
};

function renderReasoningPart(
  part: MessagePart,
  key: string,
  isMessageLoading: boolean
) {
  if (part.type === "reasoning" && part.text?.trim().length > 0) {
    return (
      <MessageReasoning
        isLoading={isMessageLoading}
        key={key}
        reasoning={part.text}
      />
    );
  }
  return null;
}

function renderTextPart(options: {
  part: MessagePart;
  key: string;
  mode: "view" | "edit";
  message: ChatMessage;
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  setMode: Dispatch<SetStateAction<"view" | "edit">>;
}) {
  const { part, key, mode, message, regenerate, setMessages, setMode } =
    options;

  if (part.type !== "text") {
    return null;
  }

  if (mode === "view") {
    return (
      <div key={key}>
        <MessageContent
          className={cn({
            "w-fit break-words rounded-lg px-3 py-2 text-right text-foreground":
              message.role === "user",
            "bg-transparent px-0 py-0 text-left": message.role === "assistant",
          })}
          data-testid="message-content"
        >
          <Response>{sanitizeText(part.text)}</Response>
        </MessageContent>
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <div className="flex w-full flex-row items-start gap-3" key={key}>
        <div className="size-8" />
        <div className="min-w-0 flex-1">
          <MessageEditor
            key={message.id}
            message={message}
            regenerate={regenerate}
            setMessages={setMessages}
            setMode={setMode}
          />
        </div>
      </div>
    );
  }

  return null;
}

function renderMessagePart({
  part,
  key,
  mode,
  message,
  isLoading,
  regenerate,
  setMessages,
  setMode,
}: RenderMessagePartParams) {
  const { type } = part;

  if (type === "reasoning") {
    return renderReasoningPart(part, key, isLoading);
  }

  if (type === "text") {
    return renderTextPart({
      part,
      key,
      mode,
      message,
      regenerate,
      setMessages,
      setMode,
    });
  }

  // Tool parts are handled by ToolsSection, skip here
  if (type.startsWith("tool-")) {
    return null;
  }

  return null;
}

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding,
  toolsSummary,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  toolsSummary: string | null;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  // Separate tool parts from other parts
  const toolParts = useMemo(() => {
    return (
      message.parts
        ?.filter((part) => part.type.startsWith("tool-"))
        .map((part) => ({
          type: part.type,
          toolCallId: (part as { toolCallId: string }).toolCallId,
          state: (part as { state: string }).state as
            | "input-streaming"
            | "input-available"
            | "output-available"
            | "output-error",
          input: (part as { input?: Record<string, unknown> }).input,
          output: (part as { output?: unknown }).output,
        })) ?? []
    );
  }, [message.parts]);

  // Check if assistant message has visible content
  const hasVisibleContent =
    message.role !== "assistant" ||
    message.parts?.some((part) => {
      if (part.type === "text" && part.text?.trim()) return true;
      if (part.type.startsWith("tool-")) return true;
      return false;
    });

  // Show thinking indicator for assistant messages without content
  const showThinkingIndicator =
    message.role === "assistant" && isLoading && !hasVisibleContent;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full min-w-0"
      data-role={message.role}
      data-testid={`message-${message.role}`}
      initial={{ opacity: 0 }}
    >
      <div
        className={cn("flex w-full min-w-0 items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        {message.role === "assistant" && (
          <img
            alt="Gemeente Den Haag"
            className="mt-1 hidden size-6 shrink-0 md:block"
            height={24}
            src="/images/Compact_Logo_gemeente_Den_Haag.svg"
            width={24}
          />
        )}

        <div
          className={cn("flex min-w-0 flex-col gap-2 md:gap-4", {
            "min-h-96": message.role === "assistant" && requiresScrollPadding,
            "w-full": message.role === "assistant" || mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {showThinkingIndicator && (
            <div className="flex items-center gap-2 pt-1">
              <ThinkingDots />
              <span className="text-muted-foreground text-sm">
                Aan het denken
              </span>
            </div>
          )}

          {/* Render tool status section */}
          {toolParts.length > 0 && (
            <ToolsSection parts={toolParts} toolsSummary={toolsSummary} />
          )}

          {/* Render non-tool parts */}
          {message.parts?.map((part, index) => {
            const key = `message-${message.id}-part-${index}`;
            return renderMessagePart({
              part,
              key,
              mode,
              message,
              isLoading,
              regenerate,
              setMessages,
              setMode,
            });
          })}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              setMode={setMode}
              vote={vote}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Note: No custom memo comparator - React's default behavior handles streaming correctly
// The message object reference changes on each streaming update, triggering re-renders
export const PreviewMessage = memo(PurePreviewMessage);

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="group/message w-full"
      data-role={role}
      data-testid="message-assistant-loading"
      initial={{ opacity: 0 }}
    >
      <div className="flex items-start justify-start gap-2 md:gap-3">
        <img
          alt="Gemeente Den Haag"
          className="mt-1 hidden size-6 shrink-0 md:block"
          height={24}
          src="/images/Compact_Logo_gemeente_Den_Haag.svg"
          width={24}
        />
        <div className="flex items-center gap-2 pt-1">
          <ThinkingDots />
          <span className="text-muted-foreground text-sm">Aan het denken</span>
        </div>
      </div>
    </motion.div>
  );
};

const ThinkingDots = () => (
  <div className="flex items-center gap-0.5">
    {[0, 1, 2].map((i) => (
      <motion.div
        animate={{ opacity: [0.4, 1, 0.4] }}
        className="size-1 rounded-full bg-muted-foreground"
        key={i}
        transition={{
          duration: 1,
          repeat: Number.POSITIVE_INFINITY,
          delay: i * 0.15,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);
