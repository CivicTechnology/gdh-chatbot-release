"use client";

import type { ToolUIPart } from "ai";
import { CheckIcon, ChevronDownIcon, Loader2Icon, XIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { lazy, Suspense } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const CodeBlock = lazy(() =>
  import("./code-block").then((mod) => ({ default: mod.CodeBlock }))
);

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible className={cn("group not-prose w-full", className)} {...props} />
);

export type ToolHeaderProps = Omit<
  ComponentProps<typeof CollapsibleTrigger>,
  "type"
> & {
  toolType: ToolUIPart["type"];
  state: ToolUIPart["state"];
  label?: string;
  isCollapsible?: boolean;
  hasError?: boolean;
};

const getStatusIndicator = (
  status: ToolUIPart["state"],
  hasError?: boolean
) => {
  // Error prop overrides state to ensure error indicator shows
  if (hasError) {
    return <XIcon className="size-3 text-destructive" />;
  }
  if (status === "input-streaming" || status === "input-available") {
    return (
      <Loader2Icon className="size-3 animate-spin text-muted-foreground" />
    );
  }
  if (status === "output-available") {
    return <CheckIcon className="size-3 text-primary" />;
  }
  if (status === "output-error") {
    return <XIcon className="size-3 text-destructive" />;
  }
  return null;
};

export const ToolHeader = ({
  className,
  toolType,
  state,
  label,
  isCollapsible = true,
  hasError,
  ...props
}: ToolHeaderProps) => (
  <CollapsibleTrigger
    className={cn(
      "flex w-full min-w-0 items-center gap-2 py-1 text-muted-foreground text-xs",
      !isCollapsible && "cursor-default",
      className
    )}
    disabled={!isCollapsible}
    type="button"
    {...props}
  >
    {getStatusIndicator(state, hasError)}
    <span className="truncate">{label ?? toolType}</span>
    {isCollapsible && (
      <ChevronDownIcon className="size-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
    )}
  </CollapsibleTrigger>
);

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn("text-muted-foreground text-xs", className)}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: ToolUIPart["input"];
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("mt-1 rounded bg-muted/50 p-2", className)} {...props}>
    <Suspense
      fallback={
        <div className="flex min-h-[100px] items-center justify-center text-muted-foreground text-xs">
          Loading code block...
        </div>
      }
    >
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </Suspense>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ReactNode;
  errorText: ToolUIPart["errorText"];
};

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-1 rounded text-xs",
        errorText ? "text-destructive" : "text-muted-foreground",
        className
      )}
      {...props}
    >
      {errorText && <span>{errorText}</span>}
      {output && <div>{output}</div>}
    </div>
  );
};
