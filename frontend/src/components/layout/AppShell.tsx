import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { authService, type AuthRole } from "@/services/authService";

function useRequireRole(requiredRole: AuthRole) {
  const navigate = useNavigate();

  useEffect(() => {
    const user = authService.getCurrentUser();

    if (!user) {
      void navigate({ to: "/login", replace: true });
      return;
    }

    if (requiredRole === "admin" && user.role !== "admin") {
      void navigate({ to: "/app", replace: true });
      return;
    }

    if (requiredRole === "user" && user.role === "admin") {
      void navigate({ to: "/admin", replace: true });
    }
  }, [navigate, requiredRole]);
}

export function AppShell({ children }: { children: ReactNode }) {
  useRequireRole("user");

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar variant="user" />
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  useRequireRole("admin");

  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar variant="admin" />
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
    </div>
  );
}
