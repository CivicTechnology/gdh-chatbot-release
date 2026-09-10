import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { OverZoektool } from "@/components/over-zoektool";
import { ShareDialog } from "@/components/share-dialog";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import type { VisibilityType } from "@/lib/types";
import { PlusIcon } from "./icons";

function PureChatHeader({
  chatId,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const navigate = useNavigate();

  const handleNewChat = () => {
    // Navigate to / with unique state to force ChatPage to remount
    navigate("/", { state: { key: Date.now() } });
  };

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      <Button
        className="order-2 ml-auto h-8 shrink-0 border-[--color-primary] px-2 text-primary md:order-1 md:ml-0 md:h-fit md:px-3"
        onClick={handleNewChat}
        variant="outline"
      >
        <PlusIcon />
        <span>Nieuw gesprek</span>
      </Button>

      {!isReadonly && (
        <ShareDialog
          chatId={chatId}
          className="order-1 md:order-2"
          initialVisibilityType={selectedVisibilityType}
        />
      )}

      <div className="order-3 ml-auto">
        <OverZoektool />
      </div>
    </header>
  );
}

export const ChatHeader = memo(
  PureChatHeader,
  (prevProps, nextProps) =>
    prevProps.chatId === nextProps.chatId &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
);
