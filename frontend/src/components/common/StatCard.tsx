import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatCard({
  label, value, delta, icon: Icon, tone = "primary",
}: {
  label: string; value: string | number; delta?: number; icon: LucideIcon;
  tone?: "primary" | "violet" | "success" | "warning" | "destructive";
}) {
  const toneMap = {
    primary: "from-primary/20 to-primary/0 text-primary",
    violet: "from-accent/25 to-accent/0 text-accent",
    success: "from-success/20 to-success/0 text-success",
    warning: "from-warning/20 to-warning/0 text-warning",
    destructive: "from-destructive/25 to-destructive/0 text-destructive",
  }[tone];
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden group">
      <div className={`absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br ${toneMap} blur-2xl opacity-60 group-hover:opacity-90 transition`} />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-display font-semibold">{value}</p>
          {delta !== undefined && (
            <div className={`mt-2 inline-flex items-center gap-1 text-xs ${positive ? "text-success" : "text-destructive"}`}>
              {positive ? <ArrowUpRight className="h-3 w-3"/> : <ArrowDownRight className="h-3 w-3"/>}
              {Math.abs(delta)}% vs last week
            </div>
          )}
        </div>
        <div className={`grid h-10 w-10 place-items-center rounded-xl border border-border bg-card/50`}>
          <Icon className={`h-5 w-5 ${toneMap.split(" ").pop()}`} />
        </div>
      </div>
    </div>
  );
}
