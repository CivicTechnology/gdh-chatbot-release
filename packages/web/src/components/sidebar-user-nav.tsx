import { ChevronUp, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { useTheme } from "@/components/theme-provider";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLocalChats } from "@/contexts/local-chat-context";
import { resolveApiUrl } from "@/lib/utils";
import { LoaderIcon } from "./icons";
import { toast } from "./toast";

type User = {
  id: string;
  email: string;
  type?: "regular";
};

export function SidebarUserNav({ user }: { user: User | undefined }) {
  const navigate = useNavigate();
  const { isLoading, logout, isAnonymous } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const { clearAllLocalChats, localChats } = useLocalChats();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const hasChats = isAnonymous ? localChats.length > 0 : true;

  const handleDeleteAll = async () => {
    if (isAnonymous) {
      clearAllLocalChats();
      toast({
        type: "success",
        description: "Alle chats succesvol verwijderd",
      });
      setShowDeleteAllDialog(false);
      navigate("/");
      return;
    }

    setIsDeletingAll(true);
    try {
      const response = await fetch(resolveApiUrl("/api/chat/all"), {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete all chats");
      }

      toast({
        type: "success",
        description: "Alle chats succesvol verwijderd",
      });
      navigate("/");
      window.location.reload();
    } catch {
      toast({
        type: "error",
        description: "Verwijderen van alle chats is mislukt",
      });
    } finally {
      setIsDeletingAll(false);
      setShowDeleteAllDialog(false);
    }
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {isLoading ? (
              <SidebarMenuButton className="h-10 justify-between bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
                <div className="flex flex-row gap-2">
                  <div className="size-6 animate-pulse rounded-full bg-muted" />
                  <span className="animate-pulse rounded-md bg-muted text-transparent">
                    Laden...
                  </span>
                </div>
                <div className="animate-spin text-muted-foreground">
                  <LoaderIcon />
                </div>
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                aria-label="Open user menu"
                className="h-10 bg-background data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                data-testid="user-nav-button"
              >
                {isAnonymous || !user ? (
                  <>
                    <div className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      G
                    </div>
                    <span className="truncate text-muted-foreground">Gast</span>
                  </>
                ) : (
                  <>
                    <div className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground uppercase">
                      {user.email?.charAt(0) ?? "?"}
                    </div>
                    <span className="truncate" data-testid="user-email">
                      {user.email}
                    </span>
                  </>
                )}
                <ChevronUp className="ml-auto" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-popper-anchor-width)"
            data-testid="user-nav-menu"
            side="top"
          >
            <DropdownMenuItem
              className="cursor-pointer"
              data-testid="user-nav-item-theme"
              onSelect={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
            >
              {resolvedTheme === "light" ? "Donkere modus" : "Lichte modus"}
            </DropdownMenuItem>
            {hasChats && (
              <DropdownMenuItem
                className="cursor-pointer text-destructive focus:text-destructive"
                onSelect={() => setShowDeleteAllDialog(true)}
              >
                <Trash2Icon className="mr-2 size-4" />
                Verwijder alle chats
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild data-testid="user-nav-item-auth">
              <button
                className="w-full cursor-pointer"
                onClick={async () => {
                  if (isLoading) {
                    toast({
                      type: "error",
                      description:
                        "Authenticatiestatus wordt gecontroleerd, probeer het opnieuw!",
                    });

                    return;
                  }

                  if (isAnonymous) {
                    navigate("/login");
                  } else {
                    await logout();
                    navigate("/");
                  }
                }}
                type="button"
              >
                {isAnonymous ? "Inloggen" : "Uitloggen"}
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <AlertDialog
        onOpenChange={setShowDeleteAllDialog}
        open={showDeleteAllDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alle chats verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {isAnonymous
                ? "Deze actie kan niet ongedaan worden gemaakt. Dit verwijdert al uw chats uit uw browser."
                : "Deze actie kan niet ongedaan worden gemaakt. Dit verwijdert al uw chats definitief van onze servers."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAll}>
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingAll}
              onClick={handleDeleteAll}
            >
              {isDeletingAll ? "Verwijderen..." : "Alles verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenu>
  );
}
