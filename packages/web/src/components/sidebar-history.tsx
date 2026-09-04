import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { useLocalChats } from "@/contexts/local-chat-context";
import type { Chat } from "@/lib/db/schema";
import { fetcher, resolveApiUrl } from "@/lib/utils";
import { LoaderIcon } from "./icons";
import { ChatItem } from "./sidebar-history-item";

type User = {
  id: string;
  email: string;
  type?: "regular";
};

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats
  );
};

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    return `/api/history?limit=${PAGE_SIZE}`;
  }

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) {
    return null;
  }

  return `/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

export function SidebarHistory({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const { id } = useParams();
  const isAnonymous = !user;

  // For anonymous users, load chats from context (synced with localStorage)
  const { localChats, deleteLocalChat } = useLocalChats();

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(
    // Only fetch from API if user is authenticated
    isAnonymous ? () => null : getChatHistoryPaginationKey,
    fetcher,
    {
      fallbackData: [],
    }
  );

  const navigate = useNavigate();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = isAnonymous
    ? localChats.length === 0
    : paginatedChatHistories
      ? paginatedChatHistories.every((page) => page.chats.length === 0)
      : false;

  const handleDelete = () => {
    if (isAnonymous && deleteId) {
      // Delete from localStorage via context
      deleteLocalChat(deleteId);
      toast.success("Chat succesvol verwijderd");
    } else if (deleteId) {
      // Delete from server
      const deletePromise = fetch(resolveApiUrl(`/api/chat?id=${deleteId}`), {
        method: "DELETE",
        credentials: "include",
      });

      toast.promise(deletePromise, {
        loading: "Chat verwijderen...",
        success: () => {
          mutate((chatHistories) => {
            if (chatHistories) {
              return chatHistories.map((chatHistory) => ({
                ...chatHistory,
                chats: chatHistory.chats.filter((chat) => chat.id !== deleteId),
              }));
            }
          });

          return "Chat succesvol verwijderd";
        },
        error: "Verwijderen van chat is mislukt",
      });
    }

    setShowDeleteDialog(false);

    if (deleteId === id) {
      navigate("/");
    }
  };

  if (isLoading) {
    return (
      <SidebarGroup>
        <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
          Vandaag
        </div>
        <SidebarGroupContent>
          <div className="flex flex-col">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                className="flex h-8 items-center gap-2 rounded-md px-2"
                key={item}
              >
                <div
                  className="h-4 max-w-(--skeleton-width) flex-1 rounded-md bg-sidebar-accent-foreground/10"
                  style={
                    {
                      "--skeleton-width": `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup>
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-sm text-muted-foreground">
            Uw gesprekken verschijnen hier zodra u begint met chatten.
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  // Convert local chats to Chat-compatible format for grouping
  const chatsToDisplay: Chat[] = isAnonymous
    ? localChats.map((lc) => ({
        id: lc.id,
        title: lc.title,
        createdAt: new Date(lc.createdAt),
        userId: "",
        sessionId: null,
        visibility: "private" as const,
        lastContext: null,
        updatedAt: null,
      }))
    : (paginatedChatHistories?.flatMap((page) => page.chats) ?? []);

  const groupedChats = groupChatsByDate(chatsToDisplay);

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <div className="flex flex-col gap-6">
              {groupedChats.today.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                    Vandaag
                  </div>
                  {groupedChats.today.map((chat) => (
                    <ChatItem
                      chat={chat}
                      isActive={chat.id === id}
                      isAnonymous={isAnonymous}
                      key={chat.id}
                      onDelete={(chatId) => {
                        setDeleteId(chatId);
                        setShowDeleteDialog(true);
                      }}
                      setOpenMobile={setOpenMobile}
                    />
                  ))}
                </div>
              )}

              {groupedChats.yesterday.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                    Gisteren
                  </div>
                  {groupedChats.yesterday.map((chat) => (
                    <ChatItem
                      chat={chat}
                      isActive={chat.id === id}
                      isAnonymous={isAnonymous}
                      key={chat.id}
                      onDelete={(chatId) => {
                        setDeleteId(chatId);
                        setShowDeleteDialog(true);
                      }}
                      setOpenMobile={setOpenMobile}
                    />
                  ))}
                </div>
              )}

              {groupedChats.lastWeek.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                    Afgelopen 7 dagen
                  </div>
                  {groupedChats.lastWeek.map((chat) => (
                    <ChatItem
                      chat={chat}
                      isActive={chat.id === id}
                      isAnonymous={isAnonymous}
                      key={chat.id}
                      onDelete={(chatId) => {
                        setDeleteId(chatId);
                        setShowDeleteDialog(true);
                      }}
                      setOpenMobile={setOpenMobile}
                    />
                  ))}
                </div>
              )}

              {groupedChats.lastMonth.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                    Afgelopen 30 dagen
                  </div>
                  {groupedChats.lastMonth.map((chat) => (
                    <ChatItem
                      chat={chat}
                      isActive={chat.id === id}
                      isAnonymous={isAnonymous}
                      key={chat.id}
                      onDelete={(chatId) => {
                        setDeleteId(chatId);
                        setShowDeleteDialog(true);
                      }}
                      setOpenMobile={setOpenMobile}
                    />
                  ))}
                </div>
              )}

              {groupedChats.older.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-sidebar-foreground/50 text-xs">
                    Ouder dan vorige maand
                  </div>
                  {groupedChats.older.map((chat) => (
                    <ChatItem
                      chat={chat}
                      isActive={chat.id === id}
                      isAnonymous={isAnonymous}
                      key={chat.id}
                      onDelete={(chatId) => {
                        setDeleteId(chatId);
                        setShowDeleteDialog(true);
                      }}
                      setOpenMobile={setOpenMobile}
                    />
                  ))}
                </div>
              )}
            </div>
          </SidebarMenu>

          {!isAnonymous && (
            <>
              <motion.div
                onViewportEnter={() => {
                  if (!(isValidating || hasReachedEnd)) {
                    setSize((size) => size + 1);
                  }
                }}
              />

              {hasReachedEnd ? (
                <div className="mt-8 flex w-full flex-row items-center justify-center gap-2 px-2 text-sm text-muted-foreground">
                  U heeft het einde van uw gespreksgeschiedenis bereikt.
                </div>
              ) : (
                <div className="mt-8 flex flex-row items-center gap-2 p-2 text-muted-foreground">
                  <div className="animate-spin">
                    <LoaderIcon />
                  </div>
                  <div>Chats laden...</div>
                </div>
              )}
            </>
          )}

          {isAnonymous && localChats.length > 0 && (
            <div className="mt-8 flex w-full flex-row items-center justify-center gap-2 px-2 text-sm text-muted-foreground">
              Chats worden lokaal opgeslagen in uw browser.
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Weet u het zeker?</AlertDialogTitle>
            <AlertDialogDescription>
              {isAnonymous
                ? "Deze actie kan niet ongedaan worden gemaakt. Dit verwijdert uw chat uit uw browser."
                : "Deze actie kan niet ongedaan worden gemaakt. Dit verwijdert uw chat definitief van onze servers."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Doorgaan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
