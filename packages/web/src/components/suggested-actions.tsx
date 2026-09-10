"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import {
  BadgeEuro,
  CalendarClock,
  FileText,
  HelpCircle,
  type LucideIcon,
  Scale,
  Search,
} from "lucide-react";
import { memo, useMemo, useRef } from "react";
import { toolColorClasses } from "@/components/tool-card/tool-config";
import {
  getLandingSuggestions,
  type SuggestionCategory,
} from "@/lib/suggestions";
import type { ChatMessage, VisibilityType } from "@/lib/types";
import { cn } from "@/lib/utils";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

const categoryIcons: Record<SuggestionCategory, LucideIcon> = {
  ontdekken: Search,
  voorwaarden: BadgeEuro,
  aanvragen: FileText,
  vergelijken: Scale,
  deadlines: CalendarClock,
  uitleg: HelpCircle,
};

const categoryColors: Record<SuggestionCategory, string> = {
  ontdekken: "sky",
  voorwaarden: "green",
  aanvragen: "blue",
  vergelijken: "teal",
  deadlines: "orange",
  uitleg: "purple",
};

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const suggestions = useMemo(() => getLandingSuggestions(4, "ontdekken"), []);
  // Latch so rapid double-clicks (before this list unmounts on first send)
  // can't fire multiple concurrent user messages on a fresh chat.
  const sentRef = useRef(false);

  return (
    <div
      className="mx-auto grid max-w-2xl grid-cols-2 gap-2"
      data-testid="suggested-actions"
    >
      {suggestions.map((suggestion, index) => {
        const Icon = categoryIcons[suggestion.category];
        const colorKey = categoryColors[
          suggestion.category
        ] as keyof typeof toolColorClasses;
        const colors = toolColorClasses[colorKey];

        return (
          <motion.button
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-left text-sm transition-all duration-200",
              "hover:border-border hover:bg-muted/50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            )}
            exit={{ opacity: 0, y: 10 }}
            initial={{ opacity: 0, y: 10 }}
            key={suggestion.text}
            onClick={() => {
              if (sentRef.current) return;
              sentRef.current = true;
              window.history.replaceState({}, "", `/chat/${chatId}`);
              sendMessage({
                role: "user",
                parts: [{ type: "text", text: suggestion.text }],
              });
            }}
            transition={{ delay: 0.05 * index }}
            type="button"
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md",
                colors.iconBg
              )}
            >
              <Icon className={cn("size-3.5", colors.icon)} strokeWidth={2} />
            </span>
            <span className="line-clamp-2 text-foreground/80">
              {suggestion.text}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }

    return true;
  }
);
