import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PreviewItemProps = {
  title: string;
  subtitle?: string;
  url?: string | null;
  icon?: ReactNode;
  className?: string;
};

export function PreviewItem({
  title,
  subtitle,
  url,
  icon,
  className,
}: PreviewItemProps) {
  const content = (
    <div className={cn("flex items-start gap-2 py-1.5", className)}>
      {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{title}</div>
        {subtitle && (
          <div className="truncate text-muted-foreground text-xs">
            {subtitle}
          </div>
        )}
      </div>
      {url && (
        <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      )}
    </div>
  );

  if (url) {
    return (
      <a
        className="block rounded-md px-2 transition-colors hover:bg-muted/50"
        href={url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {content}
      </a>
    );
  }

  return <div className="px-2">{content}</div>;
}

type PreviewListProps = {
  children: ReactNode;
  moreCount?: number;
  onShowMore?: () => void;
  className?: string;
};

export function PreviewList({
  children,
  moreCount,
  onShowMore,
  className,
}: PreviewListProps) {
  return (
    <div className={cn("py-1", className)}>
      {children}
      {moreCount !== undefined && moreCount > 0 && (
        <button
          className="w-full px-2 py-1.5 text-left text-muted-foreground text-xs transition-colors hover:text-foreground"
          onClick={onShowMore}
          type="button"
        >
          +{moreCount} meer
        </button>
      )}
    </div>
  );
}
