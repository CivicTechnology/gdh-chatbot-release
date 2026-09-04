import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "./useAuth";

export function GuestRedirect() {
  const { isAuthenticated, isLoading, isAnonymous, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // If authenticated and not a guest, and on login/register page, redirect to home
    if (
      isAuthenticated &&
      !isAnonymous &&
      (location.pathname === "/login" || location.pathname === "/register")
    ) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, isAnonymous, location.pathname, navigate]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <div className="text-muted-foreground">Laden...</div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user ?? undefined} />
      <SidebarInset>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
