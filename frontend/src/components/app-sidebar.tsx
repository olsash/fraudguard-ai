import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Radar, Receipt, Bell, Brain, Workflow,
  FileBarChart, Users, Settings, ShieldAlert, Activity, GraduationCap, LogOut,
} from "lucide-react";
import { Brand } from "./brand";

const userNav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/predict", label: "AI Detection", icon: Radar },
  { to: "/app/transactions", label: "Transactions", icon: Receipt },
  { to: "/app/alerts", label: "Fraud Alerts", icon: Bell },
  { to: "/app/models", label: "AI Models", icon: Brain },
  { to: "/app/pipeline", label: "ML Pipeline", icon: Workflow },
  { to: "/app/reports", label: "Reports", icon: FileBarChart },
  { to: "/app/thesis", label: "Research", icon: GraduationCap },
];

const adminNav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/transactions", label: "Transactions", icon: Receipt },
  { to: "/admin/alerts", label: "Fraud Alerts", icon: ShieldAlert },
  { to: "/admin/models", label: "AI Models", icon: Brain },
  { to: "/admin/logs", label: "System Logs", icon: Activity },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AppSidebar({ variant = "user" }: { variant?: "user" | "admin" }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = variant === "admin" ? adminNav : userNav;
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-sidebar/80 backdrop-blur-xl">
      <div className="p-5 border-b border-border">
        <Link to="/"><Brand /></Link>
        <p className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {variant === "admin" ? "Admin Console" : "Fraud Workspace"}
        </p>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scrollbar-thin">
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
      <div className="p-3 border-t border-border space-y-1">
        <Link to="/app/profile" className="flex items-center gap-3 rounded-lg p-2 hover:bg-sidebar-accent">
          <div className="h-9 w-9 rounded-full bg-gradient-primary grid place-items-center text-sm font-semibold text-primary-foreground">SA</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">Sara Amrani</p>
            <p className="text-xs text-muted-foreground truncate">{variant === "admin" ? "Administrator" : "Analyst"}</p>
          </div>
        </Link>
        <Link to="/login" className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-destructive">
          <LogOut className="h-3.5 w-3.5"/> Sign out
        </Link>
      </div>
    </aside>
  );
}
