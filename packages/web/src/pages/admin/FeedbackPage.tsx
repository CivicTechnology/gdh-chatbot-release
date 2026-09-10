import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MessagesSquareIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  type AdminFeedbackItem,
  type FeedbackRating,
  type FeedbackStats,
  feedbackApi,
  type SharedChatResponse,
} from "@/api/feedback";
import { FeedbackVoteBadge } from "@/components/feedback-vote-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GhostList } from "./_components";

const PAGE_SIZE = 20;

const RATING_CHIPS: Array<{ label: string; value: FeedbackRating | "all" }> = [
  { label: "Alles", value: "all" },
  { label: "Positief", value: "up" },
  { label: "Negatief", value: "down" },
];

function StatBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3">
      <span className="font-semibold text-2xl tabular-nums">{value}</span>
      <span className="text-muted-foreground text-sm">{label}</span>
    </div>
  );
}

/** Vraag/antwoord-blok met een uitklap-toggle voor lange antwoorden. */
function PromptResponse({ item }: { item: AdminFeedbackItem }) {
  const [expanded, setExpanded] = useState(false);
  const isLongResponse = (item.response?.length ?? 0) > 320;

  return (
    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-muted-foreground text-xs">
          Vraag van de gebruiker
        </span>
        <p className="whitespace-pre-wrap">
          {item.prompt || <span className="text-muted-foreground">—</span>}
        </p>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-muted-foreground text-xs">
          Beoordeeld antwoord
        </span>
        <p className={cn("whitespace-pre-wrap", !expanded && "line-clamp-4")}>
          {item.response || <span className="text-muted-foreground">—</span>}
        </p>
        {isLongResponse && (
          <button
            className="self-start text-muted-foreground text-xs underline-offset-2 hover:underline"
            onClick={() => setExpanded((current) => !current)}
            type="button"
          >
            {expanded ? "Toon minder" : "Toon volledig antwoord"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState<AdminFeedbackItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [sharedChat, setSharedChat] = useState<SharedChatResponse | null>(null);
  const [sharedChatOpen, setSharedChatOpen] = useState(false);
  const [sharedChatLoading, setSharedChatLoading] = useState(false);

  const rating = useMemo<FeedbackRating | "all">(() => {
    const raw = params.get("rating");
    return raw === "up" || raw === "down" ? raw : "all";
  }, [params]);

  const page = useMemo<number>(() => {
    const raw = Number.parseInt(params.get("page") ?? "1", 10);
    return Number.isFinite(raw) && raw >= 1 ? raw : 1;
  }, [params]);

  const load = useCallback(async () => {
    const query = new URLSearchParams();
    if (rating !== "all") {
      query.set("rating", rating);
    }
    query.set("limit", String(PAGE_SIZE));
    query.set("offset", String((page - 1) * PAGE_SIZE));

    const result = await feedbackApi.list(query);

    if (result.error || !result.data) {
      setError(result.error ?? "Feedback laden mislukt");
      return;
    }

    setError(null);
    setItems(result.data.items);
    setTotal(result.data.total);
    setStats(result.data.stats);
  }, [rating, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setRatingFilter = (value: FeedbackRating | "all") => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === "all") {
          next.delete("rating");
        } else {
          next.set("rating", value);
        }
        next.delete("page");
        return next;
      },
      { replace: true }
    );
  };

  const setPage = (value: number) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value <= 1) {
          next.delete("page");
        } else {
          next.set("page", String(value));
        }
        return next;
      },
      { replace: true }
    );
  };

  const openSharedChat = async (item: AdminFeedbackItem) => {
    setSharedChatOpen(true);
    setSharedChatLoading(true);
    setSharedChat(null);

    const result = await feedbackApi.sharedChat(item.id);
    setSharedChatLoading(false);

    if (result.error || !result.data) {
      setError(result.error ?? "Gesprek laden mislukt");
      setSharedChatOpen(false);
      return;
    }

    setSharedChat(result.data);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const positivePercentage =
    stats && stats.total > 0
      ? `${Math.round((stats.upCount / stats.total) * 100)}%`
      : "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">Feedback</h1>
        <p className="text-muted-foreground text-sm">
          Beoordelingen van gebruikers op antwoorden van de zoektool. Alleen bij
          een gedeeld gesprek is de volledige chat zichtbaar; anders ziet u
          uitsluitend de vraag en het beoordeelde antwoord.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBlock
          label="Beoordelingen"
          value={stats ? String(stats.total) : "—"}
        />
        <StatBlock label="Positief" value={positivePercentage} />
        <StatBlock
          label="Met toelichting"
          value={stats ? String(stats.withComment) : "—"}
        />
        <StatBlock
          label="Gedeelde gesprekken"
          value={stats ? String(stats.sharedCount) : "—"}
        />
      </div>

      <div className="flex items-center gap-1.5">
        {RATING_CHIPS.map((chip) => (
          <Button
            key={chip.value}
            onClick={() => setRatingFilter(chip.value)}
            size="sm"
            variant={rating === chip.value ? "secondary" : "ghost"}
          >
            {chip.label}
          </Button>
        ))}
      </div>

      {items !== null && items.length === 0 ? (
        <div className="rounded-lg border">
          <GhostList count={4} label="Nog geen feedback ontvangen" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {(items ?? []).map((item) => (
            <div
              className="flex flex-col gap-3 rounded-lg border bg-card p-4"
              key={item.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FeedbackVoteBadge vote={item.isUpvoted ? "up" : "down"} />
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">
                      {item.isUpvoted
                        ? "Positieve beoordeling"
                        : "Negatieve beoordeling"}
                    </span>
                    <span
                      className="text-muted-foreground text-xs"
                      title={formatDateTime(item.createdAt)}
                    >
                      {formatRelative(item.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.chatShared ? (
                    <Button
                      onClick={() => openSharedChat(item)}
                      size="sm"
                      variant="outline"
                    >
                      <MessagesSquareIcon
                        aria-hidden="true"
                        className="mr-1.5 size-3.5"
                      />
                      Bekijk gesprek
                    </Button>
                  ) : (
                    <Badge variant="outline">Niet gedeeld</Badge>
                  )}
                </div>
              </div>

              {item.comment && (
                <blockquote className="border-l-2 pl-3 text-sm italic">
                  “{item.comment}”
                </blockquote>
              )}

              <PromptResponse item={item} />
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Pagina {page} van {totalPages} · {total} beoordelingen
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              size="sm"
              variant="outline"
            >
              <ChevronLeftIcon aria-hidden="true" className="mr-1 size-3.5" />
              Vorige
            </Button>
            <Button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              size="sm"
              variant="outline"
            >
              Volgende
              <ChevronRightIcon aria-hidden="true" className="ml-1 size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <Sheet onOpenChange={setSharedChatOpen} open={sharedChatOpen}>
        <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>
              {sharedChat?.chat.title ?? "Gedeeld gesprek"}
            </SheetTitle>
            <SheetDescription>
              {sharedChat
                ? `Gestart op ${formatDateTime(sharedChat.chat.createdAt)}. Door de gebruiker gedeeld bij het geven van feedback.`
                : "Gesprek laden..."}
            </SheetDescription>
          </SheetHeader>

          {sharedChatLoading && (
            <div className="rounded-lg border">
              <GhostList count={4} label="Gesprek laden..." />
            </div>
          )}

          {sharedChat && (
            <div className="flex flex-col gap-3">
              {sharedChat.messages.map((message) => (
                <div
                  className={cn(
                    "flex max-w-[85%] flex-col gap-1 rounded-lg border px-3 py-2 text-sm",
                    message.role === "user"
                      ? "self-end bg-primary/5"
                      : "self-start bg-muted/40"
                  )}
                  key={message.id}
                >
                  <span className="font-medium text-muted-foreground text-xs">
                    {message.role === "user" ? "Gebruiker" : "Zoektool"}
                  </span>
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              ))}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
