import { Bell, Search, Sparkles } from "lucide-react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 md:px-8 h-16">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-display font-semibold truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <div className="hidden md:flex items-center gap-2 glass rounded-lg px-3 py-1.5 w-72">
          <Search className="h-4 w-4 text-muted-foreground"/>
          <input placeholder="Search transactions, users, alerts…" className="bg-transparent flex-1 text-sm outline-none placeholder:text-muted-foreground"/>
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">⌘K</kbd>
        </div>
        <button className="relative h-9 w-9 grid place-items-center rounded-lg glass hover:ring-1 hover:ring-primary/40">
          <Sparkles className="h-4 w-4 text-primary"/>
        </button>
        <button className="relative h-9 w-9 grid place-items-center rounded-lg glass hover:ring-1 hover:ring-primary/40">
          <Bell className="h-4 w-4"/>
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse-glow"/>
        </button>
      </div>
      <FraudTicker />
    </header>
  );
}

const tickerItems = [
  "🛡  Model NN-v4 accuracy steady at 99.41%",
  "⚠  3 high-risk transactions flagged in EU region",
  "✓  Live stream healthy — 1.2k tx/sec",
  "🚨 Alert ALT-1042 escalated to investigation",
  "🌍 Geo anomaly: card swiped in JP & BR within 4 min",
  "💳 Velocity rule triggered on user_184",
];

function FraudTicker() {
  return (
    <div className="border-t border-border bg-card/30 overflow-hidden">
      <div className="flex gap-12 py-1.5 whitespace-nowrap text-xs text-muted-foreground animate-ticker">
        {[...tickerItems, ...tickerItems].map((t, i) => (
          <span key={i} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary"/>{t}</span>
        ))}
      </div>
    </div>
  );
}
