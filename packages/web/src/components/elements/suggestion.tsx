"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export type SuggestionsProps = ComponentProps<typeof ScrollArea>;

export const Suggestions = ({
  className,
  children,
  ...props
}: SuggestionsProps) => (
  <ScrollArea className="h-40 w-full" {...props}>
    <div className="flex flex-col gap-2 p-2">{children}</div>
  </ScrollArea>
);

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  onApply?: () => void;
};

export const Suggestion = ({
  children,
  onApply,
  ...props
}: SuggestionProps) => (
  <Button
    className="flex w-full items-start justify-between gap-2 whitespace-pre-wrap"
    onClick={onApply}
    type="button"
    variant="secondary"
    {...props}
  >
    <span>{children}</span>
  </Button>
);
