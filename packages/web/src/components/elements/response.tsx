"use client";

import { AnimatedMarkdown } from "flowtoken";
import { memo, type ReactNode } from "react";
import "flowtoken/dist/styles.css";
import { cn } from "@/lib/utils";
import "./response.css";

interface ResponseProps {
  children: ReactNode;
  className?: string;
}

export const Response = memo(
  ({ children, className }: ResponseProps) => {
    const content =
      typeof children === "string" ? children : String(children ?? "");

    return (
      <div
        className={cn(
          "prose prose-neutral dark:prose-invert prose-sm max-w-none w-full min-w-0",
          "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          "[&_code]:whitespace-pre-wrap [&_code]:break-words",
          "[&_pre]:max-w-full [&_pre]:overflow-x-auto",
          "[&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:block [&_table]:w-fit",
          className
        )}
      >
        <AnimatedMarkdown
          content={content}
          sep="word"
          animation="slideUp"
          animationDuration="0.3s"
          animationTimingFunction="ease-out"
        />
      </div>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
