import { Link } from "react-router-dom";

type User = {
  id: string;
  email: string;
  type?: "regular";
};

import { SidebarHistory } from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar className="group-data-[side=left]:border-r-0">
      <SidebarHeader>
        <SidebarMenu>
          {/*
            Geen losse plus-knop meer naast het logo: "Nieuw gesprek" staat
            altijd zichtbaar in de chat-kop, met tekstlabel. Twee knoppen voor
            dezelfde actie, waarvan een zonder label, leverde verwarring op.
          */}
          <div className="flex flex-row items-center">
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
