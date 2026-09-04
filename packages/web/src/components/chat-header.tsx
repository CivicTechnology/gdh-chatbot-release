import { memo } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlusIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

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
  const { open } = useSidebar();

  const handleNewChat = () => {
    // Navigate to / with unique state to force ChatPage to remount
    navigate("/", { state: { key: Date.now() } });
  };

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      <Button
        className={cn(
          "order-2 ml-auto h-8 border-[--color-primary] px-2 text-primary md:order-1 md:ml-0 md:h-fit md:px-2",
          open && "md:hidden"
        )}
        onClick={handleNewChat}
        variant="outline"
      >
        <PlusIcon />
        <span className="md:sr-only">Nieuw gesprek</span>
      </Button>

      {!isReadonly && (
        <VisibilitySelector
          chatId={chatId}
          className="order-1 md:order-2"
          selectedVisibilityType={selectedVisibilityType}
        />
      )}
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
