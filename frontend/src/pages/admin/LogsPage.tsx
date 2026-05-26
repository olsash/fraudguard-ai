import { Topbar } from "@/components/layout/Topbar";
import { Activity, AlertCircle, CheckCircle2, Info } from "lucide-react";

const logs = Array.from({ length: 40 }).map((_, i) => {
  const level = (["info", "warn", "error", "success"] as const)[i % 4];
  const messages = [
    "Inference batch processed (1024 records)",
    "Model NN-v4 latency 12ms - within SLO",
    "User user_127 authentication failed (3rd attempt)",
    "Alert ALT-1042 escalated to investigation",
    "Database connection pool saturated",
    "Cron job 'retrain-daily' completed in 8m 22s",
    "Webhook delivery to /payments/notify succeeded",
    "Detected concept drift in feature 'amount'",
  ];

  return {
    id: 9000 - i,
    level,
    msg: messages[i % messages.length],
    src: ["api", "ml-worker", "auth", "scheduler", "db"][i % 5],
    time: new Date(Date.now() - i * 60_000 * 3).toISOString(),
  };
});

const colors = {
  info: "text-primary bg-primary/10",
  warn: "text-warning bg-warning/10",
  error: "text-destructive bg-destructive/10",
  success: "text-success bg-success/10",
};

const icons = {
  info: Info,
  warn: AlertCircle,
  error: AlertCircle,
  success: CheckCircle2,
};

export default function Logs() {
  return (
    <>
      <Topbar title="System Logs" subtitle="Real-time platform activity"/>
      <main className="flex-1 p-4 md:p-8">
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary"/>
            <span className="text-sm font-display font-semibold">Live logs</span>
            <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-success animate-pulse-glow"/> Streaming</span>
          </div>
          <div className="font-mono text-xs divide-y divide-border/50 max-h-[70vh] overflow-y-auto scrollbar-thin">
            {logs.map(l => {
              const Icon = icons[l.level];
              return (
                <div key={l.id} className="px-5 py-2.5 flex items-center gap-3 hover:bg-secondary/30">
                  <span className="text-muted-foreground">{new Date(l.time).toLocaleTimeString()}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${colors[l.level]}`}>
                    <Icon className="h-3 w-3 inline mr-1"/>{l.level}
                  </span>
                  <span className="text-muted-foreground">[{l.src}]</span>
                  <span className="flex-1">{l.msg}</span>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </>
  );
}
