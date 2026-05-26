import { Topbar } from "@/components/layout/Topbar";
import { alerts } from "@/data/mockData";
import { AlertTriangle, ShieldAlert, Clock, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/pages/transactions/TransactionsPage";

const sevColor: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-primary/15 text-primary border-primary/30",
};

export default function AlertsPage() {
  return (
    <>
      <Topbar title="Fraud Alert Center" subtitle="Security operations - live triage"/>
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Open alerts", 14, "destructive"], ["Investigating", 6, "warning"],
            ["Resolved today", 22, "success"], ["Avg. response", "4m 12s", "primary"],
          ].map(([l, v, t]) => (
            <div key={l as string} className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{l}</p>
              <p className={`mt-2 text-2xl font-display font-semibold text-${t}`}>{v}</p>
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl">
          <div className="p-5 border-b border-border flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive"/>
            <div>
              <p className="font-display font-semibold">Active alerts</p>
              <p className="text-xs text-muted-foreground">Live triage queue</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {alerts.map(a => (
              <div key={a.id} className="p-5 flex flex-wrap items-center gap-4 hover:bg-secondary/30 transition">
                <div className={`h-10 w-10 rounded-xl border grid place-items-center ${sevColor[a.severity]}`}>
                  <AlertTriangle className="h-5 w-5"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{a.title}</p>
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${sevColor[a.severity]}`}>{a.severity}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{a.id} - {a.user} - ${a.amount}</p>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3"/>{new Date(a.time).toLocaleTimeString()}</div>
                <StatusBadge s={a.status}/>
                <ChevronRight className="h-4 w-4 text-muted-foreground"/>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="font-display font-semibold">Investigation timeline - ALT-1042</p>
          <ol className="mt-5 relative border-l border-border ml-3 space-y-5">
            {[
              ["Alert raised", "Velocity anomaly detected by NN-v4", "12:04"],
              ["Auto-block", "Card temporarily suspended", "12:04"],
              ["Analyst assigned", "Sara Amrani opened case", "12:09"],
              ["Customer contacted", "Step-up verification sent via SMS", "12:14"],
              ["Resolution", "Confirmed legitimate - card re-enabled", "12:31"],
            ].map(([t, d, time]) => (
              <li key={t} className="ml-5">
                <span className="absolute -left-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background"/>
                <p className="text-sm font-medium">{t} <span className="ml-2 text-xs text-muted-foreground">{time}</span></p>
                <p className="text-xs text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </>
  );
}
