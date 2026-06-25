import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export function StatCard({
  label, value, delta, icon: Icon, tone = "primary", valueSize = "default",
}: {
  label: string; value: string | number; delta?: number; icon: LucideIcon;
  tone?: "primary" | "violet" | "success" | "warning" | "destructive";
  valueSize?: "default" | "compact";
}) {
  const toneMap = {
    primary: "from-primary/20 to-primary/0 text-primary",
    violet: "from-accent/25 to-accent/0 text-accent",
    success: "from-success/20 to-success/0 text-success",
    warning: "from-warning/20 to-warning/0 text-warning",
    destructive: "from-destructive/25 to-destructive/0 text-destructive",
  }[tone];
  const valueClass = valueSize === "compact"
    ? "text-[clamp(1.125rem,1rem+0.5vw,1.5rem)]"
    : "text-[clamp(1.45rem,1.15rem+0.7vw,1.875rem)]";
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden group min-h-[132px]">
      <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${toneMap} blur-2xl opacity-50 group-hover:opacity-80 transition`} />
      <div className="relative flex h-full min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-xs uppercase tracking-widest leading-snug text-muted-foreground">{label}</p>
          <p
            className={`mt-2 break-words font-display font-semibold leading-tight ${valueClass}`}
            title={String(value)}
          >
            {value}
          </p>
          {delta !== undefined && (
            <div className={`mt-2 inline-flex items-center gap-1 text-xs ${positive ? "text-success" : "text-destructive"}`}>
              {positive ? <ArrowUpRight className="h-3 w-3"/> : <ArrowDownRight className="h-3 w-3"/>}
              {Math.abs(delta)}% vs last week
            </div>
          )}
        </div>
        <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-border bg-card/50">
          <Icon className={`h-5 w-5 ${toneMap.split(" ").pop()}`} />
        </div>
      </div>
    </div>
  );
}
