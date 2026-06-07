import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Radar, Receipt, Bell,
  Users, Settings, ShieldAlert, Activity, LogOut, UserCircle,
} from "lucide-react";
import { Brand } from "@/components/common/Brand";
import { AUTH_USER_CHANGED_EVENT, authService, type AuthUser } from "@/services/authService";

const userNav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/transactions", label: "Transactions", icon: Receipt },
  { to: "/app/predict", label: "Predictions", icon: Radar },
  { to: "/app/alerts", label: "Alerts", icon: Bell },
  { to: "/app/profile", label: "Profile", icon: UserCircle },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

const adminNav = [
  { to: "/admin", label: "Admin Dashboard", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/transactions", label: "Transactions", icon: Receipt },
  { to: "/admin/predictions", label: "Predictions", icon: Radar },
  { to: "/admin/alerts", label: "Alerts", icon: ShieldAlert },
  { to: "/admin/logs", label: "Logs", icon: Activity },
  { to: "/admin/profile", label: "Profile", icon: UserCircle },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ variant = "user" }: { variant?: "user" | "admin" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const nav = variant === "admin" ? adminNav : userNav;

  useEffect(() => {
    const refreshUser = () => setCurrentUser(authService.getCurrentUser());
    refreshUser();
    window.addEventListener(AUTH_USER_CHANGED_EVENT, refreshUser);
    return () => window.removeEventListener(AUTH_USER_CHANGED_EVENT, refreshUser);
  }, []);

  const profileTo = variant === "admin" ? "/admin/profile" : "/app/profile";
  const displayName = currentUser?.name ?? (variant === "admin" ? "Admin User" : "Sara Amrani");
  const initials = currentUser?.initials ?? (variant === "admin" ? "AU" : "SA");
  const roleLabel = currentUser?.role === "admin" ? "Administrator" : "User";

  return (
    <aside className="hidden md:flex sticky top-0 h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar/80 backdrop-blur-xl">
      <div className="p-5 border-b border-border shrink-0">
        <Link to="/"><Brand /></Link>
        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {variant === "admin" ? "Admin Console" : "Fraud Workspace"}
        </p>
      </div>
      <nav className="min-h-0 flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
        {nav.map((item) => {
          const active = pathname === item.to || (item.to !== "/app" && item.to !== "/admin" && pathname.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all
                ${active
                  ? "bg-gradient-to-r from-primary/15 to-accent/5 text-foreground ring-1 ring-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                }`}
            >
              <item.icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
              <span className="font-medium">{item.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 p-3 border-t border-border space-y-1">
        <Link to={profileTo} className="flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent">
          <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-sm font-semibold text-primary-foreground">{initials}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>
          </div>
        </Link>
        <Link
          to="/login"
          onClick={() => authService.signOut()}
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-destructive"
        >
          <LogOut className="h-3.5 w-3.5"/> Sign out
        </Link>
      </div>
    </aside>
  );
}
