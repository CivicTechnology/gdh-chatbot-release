import { memo } from "react";
import { Link } from "react-router-dom";
import type { Chat } from "@/lib/db/schema";
import { MoreHorizontalIcon, TrashIcon } from "./icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "./ui/sidebar";

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  /**
   * Niet meer gebruikt in dit item: delen loopt via de Delen-knop in de
   * kop van het gesprek. De prop blijft staan voor de aanroep in
   * sidebar-history.tsx.
   */
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton
      asChild
      className="data-[active=true]:font-medium data-[active=true]:text-primary"
      isActive={isActive}
    >
      <Link onClick={() => setOpenMobile(false)} to={`/chat/${chat.id}`}>
        <span>{chat.title}</span>
      </Link>
    </SidebarMenuButton>

    <DropdownMenu modal={true}>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction
          className="mr-0.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          showOnHover={!isActive}
        >
          <MoreHorizontalIcon />
          <span className="sr-only">Meer</span>
        </SidebarMenuAction>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom">
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
          onSelect={() => onDelete(chat.id)}
        >
          <TrashIcon />
          <span>Verwijderen</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </SidebarMenuItem>
);

export const ChatItem = memo(
  PureChatItem,
  (prevProps, nextProps) => prevProps.isActive === nextProps.isActive
);
