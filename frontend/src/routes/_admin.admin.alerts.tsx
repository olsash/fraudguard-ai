import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/topbar";
import { alerts } from "@/lib/mock-data";
import { AlertTriangle, ShieldAlert, Clock } from "lucide-react";
import { StatusBadge } from "./_app.app.transactions";

export const Route = createFileRoute("/_admin/admin/alerts")({
  component: AdminAlerts,
});

const sev: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-primary/15 text-primary border-primary/30",
};

function AdminAlerts() {
  return (
    <>
      <Topbar title="Fraud Alerts" subtitle="Operations security center"/>
      <main className="flex-1 p-4 md:p-8">
        <div className="glass rounded-2xl">
          <div className="p-5 border-b border-border flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive"/>
            <p className="font-display font-semibold">All alerts</p>
          </div>
          <div className="divide-y divide-border">
            {alerts.map(a => (
              <div key={a.id} className="p-5 flex flex-wrap items-center gap-4">
                <div className={`h-10 w-10 rounded-xl border grid place-items-center ${sev[a.severity]}`}>
                  <AlertTriangle className="h-5 w-5"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{a.title}</p>
                  <p className="text-xs text-muted-foreground">{a.id} · {a.user} · ${a.amount}</p>
                </div>
                <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${sev[a.severity]}`}>{a.severity}</span>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3"/>{new Date(a.time).toLocaleTimeString()}</div>
                <StatusBadge s={a.status}/>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
