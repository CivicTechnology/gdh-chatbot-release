import type { ToolUIPart } from "ai";
import { AnimatedMarkdown } from "flowtoken";
import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, ChevronDownIcon, Loader2Icon } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  type ToolType,
  toolColorClasses,
  toolConfig,
} from "../tool-card/tool-config";

/** Animated text that reveals word by word with slideUp effect */
function StaggeredText({ text }: { text: string }) {
  return (
    <AnimatedMarkdown
      content={text}
      sep="word"
      animation="slideUp"
      animationDuration="0.3s"
      animationTimingFunction="ease-out"
    />
  );
}

/** Stacked tool icons showing which tools are being used */
function ToolAvatarStack({ tools }: { tools: ToolPart[] }) {
  // Get unique tool types (max 4)
  const uniqueTools = useMemo(() => {
    const seen = new Set<ToolType>();
    return tools
      .filter((t) => {
        if (seen.has(t.type)) return false;
        seen.add(t.type);
        return true;
      })
      .slice(0, 4);
  }, [tools]);

  if (uniqueTools.length <= 1) return null;

  return (
    <div className="flex -space-x-1.5">
      {uniqueTools.map((tool, i) => {
        const config = toolConfig[tool.type];
        const colors = toolColorClasses[config.color];
        const Icon = config.icon;
        const isLoading =
          tool.state === "input-streaming" || tool.state === "input-available";

        return (
          <motion.div
            key={tool.type}
            initial={{ opacity: 0, scale: 0.5, x: -8 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.2, delay: i * 0.05 }}
            className={cn(
              "flex size-5 items-center justify-center rounded-full border-2 border-background",
              colors.iconBg,
              { "animate-pulse": isLoading }
            )}
            style={{ zIndex: uniqueTools.length - i }}
          >
            <Icon className={cn("size-2.5", colors.icon)} />
          </motion.div>
        );
      })}
    </div>
  );
}

/** Success burst particles */
function SuccessBurst({ show }: { show: boolean }) {
  const particles = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        id: i,
        angle: (i * 360) / 6,
      })),
    []
  );

  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none absolute inset-0">
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute left-1/2 top-1/2 size-1 rounded-full bg-primary"
              initial={{
                x: "-50%",
                y: "-50%",
                scale: 0,
                opacity: 1,
              }}
              animate={{
                x: `calc(-50% + ${Math.cos((particle.angle * Math.PI) / 180) * 16}px)`,
                y: `calc(-50% + ${Math.sin((particle.angle * Math.PI) / 180) * 16}px)`,
                scale: [0, 1.2, 0],
                opacity: [1, 1, 0],
              }}
              transition={{
                duration: 0.4,
                ease: "easeOut",
              }}
            />
          ))}
          {/* Ring burst */}
          <motion.div
            className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary"
            initial={{ scale: 0.8, opacity: 0.8 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>
      )}
    </AnimatePresence>
  );
}

export type ToolPart = {
  type: ToolType;
  toolCallId: string;
  state: ToolUIPart["state"];
  /** User-friendly description of what this tool is doing */
  description?: string;
};

type ToolStatusProps = {
  /** All tool parts from the message */
  tools: ToolPart[];
  /** Visual outputs that should always be shown (map, weather, etc.) */
  visualOutputs?: ReactNode;
  /** LLM-generated summary text for completed tools */
  summaryText?: string | null;
  className?: string;
};

/**
 * Displays tool execution status in a compact, user-friendly way.
 *
 * - Collapsed (default): Shows current status with animated indicator
 * - Expanded: Shows timeline of all tool steps
 * - Visual outputs (map, weather) are always visible below
 */
export function ToolStatus({
  tools,
  visualOutputs,
  summaryText,
  className,
}: ToolStatusProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (tools.length === 0) {
    return visualOutputs ?? null;
  }

  // Determine overall status
  const loadingTools = tools.filter(
    (t) => t.state === "input-streaming" || t.state === "input-available"
  );
  const errorTools = tools.filter((t) => t.state === "output-error");
  const completedTools = tools.filter((t) => t.state === "output-available");

  const isLoading = loadingTools.length > 0;
  const isDone = !isLoading;
  const allFailed = isDone && errorTools.length === tools.length;
  const allSucceeded = isDone && completedTools.length === tools.length;
  const hasPartialSuccess =
    isDone && completedTools.length > 0 && errorTools.length > 0;

  // Get the current status text
  const getStatusText = () => {
    if (isLoading) {
      // Show what's currently loading
      if (loadingTools.length === 1) {
        const tool = loadingTools[0];
        return tool.description ?? toolConfig[tool.type].loadingText;
      }
      return "Informatie verzamelen...";
    }

    if (allFailed) {
      return "Er ging iets mis";
    }

    // Use LLM-generated summary if available
    if (summaryText && (hasPartialSuccess || allSucceeded)) {
      return summaryText;
    }

    // Fallback: Get unique tool labels for completed tools
    const getCompletedToolsSummary = () => {
      const uniqueLabels = [
        ...new Set(completedTools.map((t) => toolConfig[t.type].label)),
      ];
      if (uniqueLabels.length === 1) {
        return `${uniqueLabels[0]} geraadpleegd`;
      }
      if (uniqueLabels.length === 2) {
        return `${uniqueLabels[0]} en ${uniqueLabels[1]} geraadpleegd`;
      }
      // 3+ unique tools: "X, Y en Z geraadpleegd"
      const lastLabel = uniqueLabels.pop();
      return `${uniqueLabels.join(", ")} en ${lastLabel} geraadpleegd`;
    };

    if (hasPartialSuccess || allSucceeded) {
      if (completedTools.length === 1) {
        const tool = completedTools[0];
        return (
          tool.description ?? `${toolConfig[tool.type].label} geraadpleegd`
        );
      }
      return getCompletedToolsSummary();
    }

    return "Bezig...";
  };

  return (
    <div className={cn("w-full", className)}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* Main header */}
        <CollapsibleTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-muted/50">
          {/* Status indicator with success burst */}
          <div className="relative shrink-0">
            <motion.div
              className={cn(
                "flex size-5 items-center justify-center rounded-md",
                {
                  "bg-muted": isLoading,
                  "bg-destructive/10": allFailed,
                  "bg-primary/10": isDone && !allFailed,
                }
              )}
              animate={{
                scale: isDone && !allFailed ? [1, 1.1, 1] : 1,
              }}
              transition={{ duration: 0.2 }}
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
                  </motion.div>
                ) : allFailed ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                    className="size-2 rounded-full bg-destructive"
                  />
                ) : (
                  <motion.div
                    key="complete"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.15 }}
                  >
                    <CheckIcon className="size-3.5 text-primary" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <SuccessBurst show={allSucceeded} />
          </div>

          {/* Status text with staggered animation */}
          <span
            className={cn("flex-1 text-sm", {
              "text-muted-foreground": isLoading,
              "text-destructive": allFailed,
              "text-foreground": isDone && !allFailed,
            })}
          >
            <StaggeredText text={getStatusText()} />
          </span>

          {/* Stacked tool avatars */}
          <ToolAvatarStack tools={tools} />

          {/* Expand indicator */}
          {tools.length > 0 && (
            <ChevronDownIcon
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                { "rotate-180": isExpanded }
              )}
            />
          )}
        </CollapsibleTrigger>

        {/* Expanded timeline with branch structure */}
        <CollapsibleContent className="px-3" forceMount>
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                {/* Container positioned under the main icon */}
                <div className="relative ml-[9px]">
                  {/* Single continuous vertical line */}
                  <motion.div
                    className="absolute left-0 top-0 w-0.5 rounded-full bg-border"
                    initial={{ height: 0 }}
                    animate={{ height: `calc(100% - 16px)` }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  />

                  {/* Tool items */}
                  <div className="flex flex-col">
                    {tools.map((tool, index) => (
                      <ToolTimelineItem
                        key={tool.toolCallId}
                        tool={tool}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CollapsibleContent>
      </Collapsible>

      {/* Visual outputs - always visible */}
      {visualOutputs && <div className="mt-2">{visualOutputs}</div>}
    </div>
  );
}

type ToolTimelineItemProps = {
  tool: ToolPart;
  index: number;
};

function ToolTimelineItem({ tool, index }: ToolTimelineItemProps) {
  const config = toolConfig[tool.type];
  const colors = toolColorClasses[config.color];
  const Icon = config.icon;

  const isLoading =
    tool.state === "input-streaming" || tool.state === "input-available";
  const isError = tool.state === "output-error";
  const isComplete = tool.state === "output-available" && !isError;

  const text =
    tool.description ?? (isLoading ? config.loadingText : config.label);

  return (
    <motion.div
      className="relative flex items-center py-1.5"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      {/* Horizontal connector line */}
      <motion.div
        className="h-0.5 w-4 rounded-full bg-border"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.15, delay: index * 0.05 + 0.1 }}
        style={{ originX: 0 }}
      />

      {/* Icon */}
      <motion.div
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md",
          colors.iconBg,
          { "animate-pulse": isLoading }
        )}
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.15, delay: index * 0.05 + 0.15 }}
      >
        <Icon className={cn("size-3", colors.icon)} />
      </motion.div>

      {/* Text label */}
      <span
        className={cn("ml-2 flex-1 text-sm", {
          "text-muted-foreground": isLoading,
          "text-destructive": isError,
          "text-foreground": isComplete,
        })}
      >
        {text}
      </span>

      {/* Status indicator */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15 }}
          >
            <CheckIcon className="size-3 shrink-0 text-primary" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
