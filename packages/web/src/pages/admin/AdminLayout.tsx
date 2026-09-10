import { ChevronDownIcon, LogOutIcon } from "lucide-react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AdminPageTransition } from "./_components";

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, isLoading, logout } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Laden...</div>;
  }

  if (!user) {
    return (
      <UnauthorizedScreen
        title="Inloggen vereist"
        description="Het beheerportaal is afgesloten. Log eerst in met een beheerder-account."
        actionLabel="Naar inloggen"
        onAction={() => navigate("/login")}
      />
    );
  }

  if (user.role !== "beheerder") {
    return (
      <UnauthorizedScreen
        title="Geen toegang"
        description="Uw account heeft geen beheerder-rol. Vraag een collega om de rol toe te kennen."
        actionLabel="Terug naar de chatbot"
        onAction={() => navigate("/")}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link className="flex items-center gap-3" to="/admin">
              <img
                alt="Gemeente Den Haag"
                className="size-8"
                src="/images/Compact_Logo_gemeente_Den_Haag.svg"
              />
              <span className="font-semibold text-sm">KID Beheerportaal</span>
            </Link>
            <AdminNav />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Button asChild size="sm" variant="ghost">
              <Link to="/">Naar chatbot</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="gap-1.5 font-normal"
                  size="sm"
                  variant="ghost"
                >
                  <span
                    aria-hidden="true"
                    className="flex size-7 items-center justify-center rounded-full bg-muted font-medium text-foreground text-xs uppercase"
                  >
                    {user.email.slice(0, 1)}
                  </span>
                  {user.email}
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  Ingelogd als beheerder
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={async () => {
                    await logout();
                    navigate("/login");
                  }}
                >
                  <LogOutIcon aria-hidden="true" className="mr-2 size-4" />
                  Uitloggen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <AdminPageTransition>
          <Outlet />
        </AdminPageTransition>
      </main>
    </div>
  );
}

function AdminNav() {
  const { pathname } = useLocation();

  const links = [
    {
      label: "Subsidieregelingen",
      to: "/admin",
      active:
        pathname === "/admin" ||
        pathname.startsWith("/admin/subsidieregelingen"),
    },
    {
      label: "Feedback",
      to: "/admin/feedback",
      active: pathname.startsWith("/admin/feedback"),
    },
  ];

  return (
    <nav aria-label="Beheerportaal" className="flex items-center gap-1">
      {links.map((link) => (
        <Link
          className={cn(
            "rounded-md px-3 py-1.5 text-sm transition-colors",
            link.active
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          )}
          key={link.to}
          to={link.to}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

function UnauthorizedScreen({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="flex max-w-md flex-col gap-4 text-center">
        <h1 className="font-semibold text-2xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{description}</p>
        <Button onClick={onAction}>{actionLabel}</Button>
      </div>
    </div>
  );
}
