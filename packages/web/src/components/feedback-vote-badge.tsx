import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type FeedbackVote = "up" | "down";

/**
 * Gedeelde kleurenset voor feedback-stemmen: groen rondje voor positief,
 * rood rondje voor negatief. Gebruikt door zowel het beheerportaal als
 * de chat-UI zodat beide dezelfde visuele taal spreken.
 */
export const feedbackVoteBadgeClasses: Record<FeedbackVote, string> = {
  up: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  down: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

/**
 * Kleurklassen voor een klikbare stem-knop in geselecteerde staat.
 * Zelfde palet als de badge, met hover-varianten die de ghost-hover
 * van de Button overschrijven zodat het rondje gekleurd blijft.
 */
export const feedbackVoteButtonClasses: Record<FeedbackVote, string> = {
  up: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900 dark:hover:text-emerald-300",
  down: "bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-700 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900 dark:hover:text-red-300",
};

/**
 * Kleurklassen voor een nog niet gekozen stem-knop. De duim heeft al zijn
 * eigen kleur zodat meteen zichtbaar is dat je kunt beoordelen; bij hover
 * loopt hij op naar het volle palet van de geselecteerde staat.
 */
export const feedbackVoteIdleButtonClasses: Record<FeedbackVote, string> = {
  up: "text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950 dark:hover:text-emerald-300",
  down: "text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300",
};

const VOTE_LABELS: Record<FeedbackVote, string> = {
  up: "Positief beoordeeld",
  down: "Negatief beoordeeld",
};

/** Gekleurd rondje met duim-icoon, zoals in het feedback-overzicht. */
export function FeedbackVoteBadge({
  vote,
  className,
}: {
  vote: FeedbackVote;
  className?: string;
}) {
  const Icon = vote === "up" ? ThumbsUpIcon : ThumbsDownIcon;

  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        feedbackVoteBadgeClasses[vote],
        className
      )}
    >
      <Icon aria-label={VOTE_LABELS[vote]} className="size-4" />
    </span>
  );
}
