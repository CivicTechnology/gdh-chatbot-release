"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "framer-motion";
import {
  FileText,
  Link,
  type LucideIcon,
  Map as MapIcon,
  Scale,
  Table,
} from "lucide-react";
import { memo, useMemo } from "react";
import { toolColorClasses } from "@/components/tool-card/tool-config";
import {
  getRandomSuggestions,
  type SuggestionCategory,
} from "@/lib/suggestions";
import type { ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { VisibilityType } from "./visibility-selector";

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
};

const categoryIcons: Record<SuggestionCategory, LucideIcon> = {
  map: MapIcon,
  data: Table,
  policy: FileText,
  legal: Scale,
  practical: Link,
};

const categoryColors: Record<SuggestionCategory, string> = {
  map: "teal",
  data: "green",
  policy: "blue",
  legal: "purple",
  practical: "orange",
};

function PureSuggestedActions({ chatId, sendMessage }: SuggestedActionsProps) {
  const suggestions = useMemo(() => getRandomSuggestions(4), []);

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
