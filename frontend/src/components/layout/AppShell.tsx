import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { authService, type AuthRole } from "@/services/authService";

function canAccess(requiredRole: AuthRole, actualRole: AuthRole) {
  if (requiredRole === "admin") return actualRole === "admin";
  if (requiredRole === "fraudAnalyst") return actualRole === "admin" || actualRole === "fraudAnalyst";
  return actualRole === "user";
}

function useRequireRole(requiredRole: AuthRole) {
  const navigate = useNavigate();

  useEffect(() => {
    const user = authService.getCurrentUser();

    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }

    if (!canAccess(requiredRole, user.role)) {
      void navigate({ to: "/unauthorized", replace: true });
    }
  }, [navigate, requiredRole]);
}

export function AppShell({ children }: { children: ReactNode }) {
  useRequireRole("user");

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
      <AppSidebar variant="user" />
      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">{children}</div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  useRequireRole("admin");

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
      <AppSidebar variant="admin" />
      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">{children}</div>
    </div>
  );
}

export function AnalystShell({ children }: { children: ReactNode }) {
  useRequireRole("fraudAnalyst");

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
      <AppSidebar variant="analyst" />
      <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-x-hidden">{children}</div>
    </div>
  );
}
