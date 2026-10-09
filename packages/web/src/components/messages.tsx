import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react";
import {
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useMessages } from "@/hooks/use-messages";
import type { MessageFeedback } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Conversation, ConversationContent } from "./elements/conversation";
import { Greeting } from "./greeting";
import { PreviewMessage, ThinkingMessage } from "./message";

const BACK_TO_QUESTION_LABEL = "Terug naar uw vraag";
const TO_LATEST_MESSAGE_LABEL = "Naar het laatste bericht";

type ScrollNavButtonProps = {
  label: string;
  onClick: () => void;
  hideLabel?: boolean;
  children: ReactNode;
};

/**
 * Ronde navigatieknop die over het gesprek zweeft. Wordt gebruikt voor zowel
 * "terug naar uw vraag" als "naar het laatste bericht", zodat beide knoppen
 * hetzelfde uiterlijk en gedrag houden.
 */
function ScrollNavButton({
  children,
  hideLabel = false,
  label,
  onClick,
}: ScrollNavButtonProps) {
  return (
    <button
      className={cn(
        "pointer-events-auto flex items-center gap-2 rounded-full border bg-background py-2 text-sm shadow-sm transition-colors hover:bg-muted",
        hideLabel ? "px-2" : "px-3"
      )}
      onClick={onClick}
      title={hideLabel ? label : undefined}
      type="button"
    >
      {children}
      <span className={cn(hideLabel && "sr-only")}>{label}</span>
    </button>
  );
}

type MessagesProps = {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  feedback: MessageFeedback[] | undefined;
  messages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  isReadonly: boolean;
  selectedModelId: string;
  toolsSummary: string | null;
};

function PureMessages({
  chatId,
  status,
  feedback,
  messages,
  setMessages,
  regenerate,
  sendMessage,
  isReadonly,
  selectedModelId,
  toolsSummary,
}: MessagesProps) {
  const {
    containerRef: messagesContainerRef,
    endRef: messagesEndRef,
    isAtBottom,
    scrollToBottom,
    stopSticky,
    hasSentMessage,
  } = useMessages({
    status,
  });

  // Element van de laatst gestelde vraag, gezet via een callback-ref.
  const [questionElement, setQuestionElement] = useState<HTMLDivElement | null>(
    null
  );
  const [isQuestionVisible, setIsQuestionVisible] = useState(true);
  // Alleen relevant als de vraag boven het scherm hangt. Staat hij eronder, dan
  // hoort de gebruiker de knop "naar het laatste bericht" te gebruiken en zou
  // een omhoog-pijl de verkeerde kant op wijzen.
  const [isQuestionAbove, setIsQuestionAbove] = useState(false);

  // De vraag waar het antwoord in beeld bij hoort, dus de laatste vraag van de
  // gebruiker. Bij een vervolgvraag verspringt het anker mee.
  const latestQuestionId = useMemo(() => {
    let id: string | null = null;
    for (const message of messages) {
      if (message.role === "user") {
        id = message.id;
      }
    }
    return id;
  }, [messages]);

  useEffect(() => {
    if (status === "submitted") {
      scrollToBottom("smooth");
    }
  }, [status, scrollToBottom]);

  useEffect(() => {
    const scrollContainer = messagesContainerRef.current;

    if (!(questionElement && scrollContainer)) {
      setIsQuestionVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const lastEntry = entries.at(-1);
        if (!lastEntry) {
          return;
        }
        setIsQuestionVisible(lastEntry.isIntersecting);
        const rootTop = lastEntry.rootBounds?.top ?? 0;
        setIsQuestionAbove(lastEntry.boundingClientRect.bottom < rootTop);
      },
      { root: scrollContainer }
    );

    observer.observe(questionElement);

    return () => observer.disconnect();
  }, [questionElement, messagesContainerRef]);

  const scrollToQuestion = useCallback(() => {
    // Eerst het automatisch meescrollen uitzetten, anders trekt een lopend
    // antwoord ons meteen weer naar de onderkant.
    stopSticky();
    questionElement?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    // De knop verdwijnt zodra de vraag in beeld komt. Verplaats de focus mee,
    // anders valt een toetsenbordgebruiker terug naar het begin van de pagina.
    questionElement?.focus({ preventScroll: true });
  }, [questionElement, stopSticky]);

  const handleScrollToBottom = useCallback(
    () => scrollToBottom("smooth"),
    [scrollToBottom]
  );

  return (
    <div
      className="overscroll-behavior-contain -webkit-overflow-scrolling-touch flex-1 touch-pan-y overflow-y-scroll"
      ref={messagesContainerRef}
      style={{ overflowAnchor: "none" }}
    >
      <Conversation className="mx-auto flex min-w-0 max-w-4xl flex-col gap-4 overflow-hidden md:gap-6">
        <ConversationContent className="flex flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
          {messages.length === 0 && <Greeting />}

          {messages.map((message, index) => {
            const isLastMessage = messages.length - 1 === index;
            const isStreaming = status === "streaming" && isLastMessage;
            // Only pass tools summary to the last streaming assistant message
            const messageToolsSummary =
              isLastMessage && message.role === "assistant"
                ? toolsSummary
                : null;

            const previewMessage = (
              <PreviewMessage
                chatId={chatId}
                isLoading={isStreaming}
                isReadonly={isReadonly}
                key={message.id}
                message={message}
                regenerate={regenerate}
                requiresScrollPadding={hasSentMessage && isLastMessage}
                sendMessage={sendMessage}
                setMessages={setMessages}
                status={status}
                toolsSummary={messageToolsSummary}
                feedback={
                  feedback
                    ? feedback.find((item) => item.messageId === message.id)
                    : undefined
                }
              />
            );

            // Elk bericht krijgt dezelfde wrapper, ook als het niet het anker
            // is. Zo blijft de boomstructuur gelijk en wordt een eerder
            // bericht niet opnieuw gemount zodra het anker verspringt.
            return (
              <div
                className="min-w-0 outline-none"
                key={message.id}
                ref={
                  message.id === latestQuestionId ? setQuestionElement : null
                }
                tabIndex={message.id === latestQuestionId ? -1 : undefined}
              >
                {previewMessage}
              </div>
            );
          })}

          {status === "submitted" &&
            messages.length > 0 &&
            messages.at(-1)?.role === "user" &&
            selectedModelId !== "chat-model-reasoning" && <ThinkingMessage />}

          <div
            className="min-h-[24px] min-w-[24px] shrink-0"
            ref={messagesEndRef}
          />
        </ConversationContent>
      </Conversation>

      <div className="-translate-x-1/2 pointer-events-none absolute bottom-40 left-1/2 z-10 flex flex-col items-center gap-2">
        {latestQuestionId && !isQuestionVisible && isQuestionAbove && (
          <ScrollNavButton
            label={BACK_TO_QUESTION_LABEL}
            onClick={scrollToQuestion}
          >
            <ArrowUpIcon className="size-4" />
          </ScrollNavButton>
        )}

        {!isAtBottom && (
          <ScrollNavButton
            hideLabel
            label={TO_LATEST_MESSAGE_LABEL}
            onClick={handleScrollToBottom}
          >
            <ArrowDownIcon className="size-4" />
          </ScrollNavButton>
        )}
      </div>
    </div>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.selectedModelId !== nextProps.selectedModelId) {
    return false;
  }
  if (prevProps.messages.length !== nextProps.messages.length) {
    return false;
  }
  if (!equal(prevProps.messages, nextProps.messages)) {
    return false;
  }
  if (!equal(prevProps.feedback, nextProps.feedback)) {
    return false;
  }

  return false;
});
