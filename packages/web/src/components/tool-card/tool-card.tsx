import type { ToolUIPart } from "ai";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ToolCardSkeleton } from "./tool-card-skeleton";
import type { ToolColor, ToolType } from "./tool-config";
import { toolColorClasses, toolConfig } from "./tool-config";

type ToolCardProps = {
  type: ToolType;
  state: ToolUIPart["state"];
  resultCount?: number;
  errorText?: string;
  children?: ReactNode;
  className?: string;
  /** Override loading state (for tools with custom fetching logic) */
  isLoadingOverride?: boolean;
  /** Custom header text (overrides default) */
  headerText?: string;
};

export function ToolCard({
  type,
  state,
  resultCount = 0,
  errorText,
  children,
  className,
  isLoadingOverride,
  headerText: headerTextOverride,
}: ToolCardProps) {
  const config = toolConfig[type];
  const colors = toolColorClasses[config.color];
  const stateIsLoading =
    state === "input-streaming" || state === "input-available";
  const isLoading = isLoadingOverride ?? stateIsLoading;
  const isError = state === "output-error" || !!errorText;
  const isSuccess = state === "output-available" && !isError && !isLoading;

  const [isOpen, setIsOpen] = useState(config.defaultOpen || isSuccess);

  // Update open state when results come in
  if (isSuccess && !isOpen && resultCount > 0) {
    setIsOpen(true);
  }

  const headerText =
    headerTextOverride ??
    (isLoading
      ? config.loadingText
      : isError
        ? config.label
        : config.getResultText(resultCount));

  return (
    <Collapsible
      className={cn("w-full overflow-hidden rounded-lg border", className, {
        [colors.border]: !isError,
        "border-destructive/50": isError,
      })}
      onOpenChange={setIsOpen}
      open={isOpen}
    >
      <ToolCardHeader
        color={config.color}
        headerText={headerText}
        Icon={config.icon}
        isError={isError}
        isLoading={isLoading}
        isOpen={isOpen}
        isSuccess={isSuccess}
      />

      <CollapsibleContent>
        {isLoading && <ToolCardSkeleton color={config.color} />}
        {isError && (
          <div className="px-3 py-2 text-destructive text-sm">
            {errorText ||
              "Er is een fout opgetreden. Probeer het later opnieuw."}
          </div>
        )}
        {isSuccess && children}
      </CollapsibleContent>
    </Collapsible>
  );
}

type ToolCardHeaderProps = {
  Icon: React.ComponentType<{ className?: string }>;
  color: ToolColor;
  headerText: string;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  isOpen: boolean;
};

function ToolCardHeader({
  Icon,
  color,
  headerText,
  isLoading,
  isSuccess,
  isError,
  isOpen,
}: ToolCardHeaderProps) {
  const colors = toolColorClasses[color];

  return (
    <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50">
      {/* Icon with background */}
      <div
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md",
          colors.iconBg,
          { "animate-tool-pulse": isLoading }
        )}
      >
        <Icon className={cn("size-4", colors.icon)} />
      </div>

      {/* Header text */}
      <span
        className={cn("flex-1 truncate text-sm", {
          "text-muted-foreground": isLoading,
          [colors.text]: isSuccess,
          "text-destructive": isError,
        })}
      >
        {headerText}
      </span>

      {/* Status indicator */}
      {isSuccess && <CheckIcon className="size-4 shrink-0 text-primary" />}
      {isError && <XIcon className="size-4 shrink-0 text-destructive" />}

      {/* Chevron */}
      <ChevronDownIcon
        className={cn(
          "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
          { "rotate-180": isOpen }
        )}
      />
    </CollapsibleTrigger>
  );
}
