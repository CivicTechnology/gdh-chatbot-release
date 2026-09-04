import { cn } from "@/lib/utils";
import type { ToolColor } from "./tool-config";
import { toolColorClasses } from "./tool-config";

type ToolCardSkeletonProps = {
  color: ToolColor;
  lines?: number;
};

export function ToolCardSkeleton({ color, lines = 3 }: ToolCardSkeletonProps) {
  const colors = toolColorClasses[color];

  // Vary the widths for a more natural look
  const widths = ["85%", "65%", "75%", "55%", "70%"];

  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      {widths.slice(0, lines).map((width) => (
        <div
          className={cn(
            "h-4 rounded-md",
            colors.skeleton,
            "animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent bg-[length:200%_100%] dark:via-white/10"
          )}
          key={width}
          style={{ width }}
        />
      ))}
    </div>
  );
}
