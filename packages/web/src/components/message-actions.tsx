import equal from "fast-deep-equal";
import { memo, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { useCopyToClipboard } from "usehooks-ts";
import { FeedbackDialog } from "@/components/feedback-dialog";
import {
  feedbackVoteButtonClasses,
  feedbackVoteIdleButtonClasses,
} from "@/components/feedback-vote-badge";
import type { MessageFeedback } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { cn, resolveApiUrl } from "@/lib/utils";
import { Action, Actions } from "./elements/actions";
import { CopyIcon, PencilEditIcon, ThumbDownIcon, ThumbUpIcon } from "./icons";

type FeedbackRating = "up" | "down";

export function PureMessageActions({
  chatId,
  message,
  feedback,
  isLoading,
  setMode,
}: {
  chatId: string;
  message: ChatMessage;
  feedback: MessageFeedback | undefined;
  isLoading: boolean;
  setMode?: (mode: "view" | "edit") => void;
}) {
  const { mutate } = useSWRConfig();
  const [_, copyToClipboard] = useCopyToClipboard();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogRating, setDialogRating] = useState<FeedbackRating>("up");

  if (isLoading) {
    return null;
  }

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("Er is geen tekst om te kopiëren!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Gekopieerd naar klembord!");
  };

  // User messages get edit (on hover) and copy actions
  if (message.role === "user") {
    return (
      <Actions className="-mt-1 -mr-1 justify-end md:-mt-3">
        <div className="relative">
          {setMode && (
            <Action
              className="-left-9 absolute top-0 opacity-0 transition-opacity group-hover/message:opacity-100"
              onClick={() => setMode("edit")}
              tooltip="Bewerken"
            >
              <PencilEditIcon size={14} />
            </Action>
          )}
          <Action onClick={handleCopy} tooltip="Kopiëren">
            <CopyIcon size={14} />
          </Action>
        </div>
      </Actions>
    );
  }

  /**
   * Upsert van de feedback op dit bericht. Velden die `undefined` blijven
   * laat de API ongemoeid, zodat een losse duim-klik een eerder gegeven
   * toelichting niet wist.
   */
  const persistFeedback = async (input: {
    rating: FeedbackRating;
    comment?: string;
    chatShared?: boolean;
  }): Promise<void> => {
    const response = await fetch(resolveApiUrl("/api/feedback"), {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chatId,
        messageId: message.id,
        ...input,
      }),
    });

    if (!response.ok) {
      throw new Error("Feedback opslaan mislukt");
    }

    const saved: MessageFeedback = await response.json();

    mutate<MessageFeedback[]>(
      `/api/feedback?chatId=${chatId}`,
      (current) => {
        const withoutCurrent = (current ?? []).filter(
          (item) => item.messageId !== message.id
        );
        return [...withoutCurrent, saved];
      },
      { revalidate: false }
    );
  };

  const handleRate = (rating: FeedbackRating) => {
    // Duim direct opslaan; de dialog is een optioneel vervolg.
    const request = persistFeedback({ rating });

    toast.promise(request, {
      loading: "Reactie beoordelen...",
      success: () => {
        setDialogRating(rating);
        setDialogOpen(true);
        return rating === "up"
          ? "Positief beoordeeld!"
          : "Negatief beoordeeld!";
      },
      error: "Beoordelen mislukt.",
    });
  };

  const handleDialogSubmit = async (input: {
    comment: string;
    chatShared: boolean;
  }) => {
    try {
      await persistFeedback({
        rating: dialogRating,
        comment: input.comment,
        chatShared: input.chatShared,
      });
      toast.success("Bedankt voor uw feedback!");
    } catch {
      toast.error("Feedback versturen mislukt.");
    }
  };

  const isUpvoted = feedback?.isUpvoted === true;
  const isDownvoted = feedback?.isUpvoted === false;

  return (
    <>
      <Actions className="-mt-1 -ml-1 md:-mt-3">
        <Action onClick={handleCopy} tooltip="Kopiëren">
          <CopyIcon size={14} />
        </Action>

        <Action
          aria-pressed={isUpvoted}
          className={cn(
            "rounded-full",
            isUpvoted
              ? feedbackVoteButtonClasses.up
              : feedbackVoteIdleButtonClasses.up
          )}
          data-testid="message-upvote"
          label={isUpvoted ? "Positief beoordeeld" : "Positief beoordelen"}
          onClick={() => handleRate("up")}
          tooltip={isUpvoted ? "Positief beoordeeld" : "Positief beoordelen"}
        >
          <ThumbUpIcon size={14} />
        </Action>

        <Action
          aria-pressed={isDownvoted}
          className={cn(
            "rounded-full",
            isDownvoted
              ? feedbackVoteButtonClasses.down
              : feedbackVoteIdleButtonClasses.down
          )}
          data-testid="message-downvote"
          label={isDownvoted ? "Negatief beoordeeld" : "Negatief beoordelen"}
          onClick={() => handleRate("down")}
          tooltip={isDownvoted ? "Negatief beoordeeld" : "Negatief beoordelen"}
        >
          <ThumbDownIcon size={14} />
        </Action>
      </Actions>

      <FeedbackDialog
        defaultChatShared={feedback?.chatShared ?? false}
        defaultComment={feedback?.comment ?? ""}
        onOpenChange={setDialogOpen}
        onSubmit={handleDialogSubmit}
        open={dialogOpen}
        rating={dialogRating}
      />
    </>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.feedback, nextProps.feedback)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }

    return true;
  }
);
