import { Link, useNavigate } from "react-router-dom";
import { PlusIcon } from "@/components/icons";

type User = {
  id: string;
  email: string;
  type?: "regular";
};

import { SidebarHistory } from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function AppSidebar({ user }: { user: User | undefined }) {
  const navigate = useNavigate();
  const { setOpenMobile } = useSidebar();

  const handleNewChat = () => {
    setOpenMobile(false);
    // Navigate to / with unique state to force ChatPage to remount
    navigate("/", { state: { key: Date.now() } });
  };

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row items-center justify-between">
            <Link
              className="flex flex-row items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted"
              onClick={() => {
                setOpenMobile(false);
              }}
              to="/"
            >
              <img
                alt="Gemeente Den Haag"
                className="size-6"
                height={24}
                src="/images/Compact_Logo_gemeente_Den_Haag.svg"
                width={24}
              />
              <span className="font-medium text-foreground text-sm">
                KID-platform
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className="h-8 p-1 md:h-fit md:p-2"
                  onClick={handleNewChat}
                  type="button"
                  variant="ghost"
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end" className="hidden md:block">
                Nieuw gesprek
              </TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarUserNav user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
