import { Bell, Search, Sparkles } from "lucide-react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="flex items-center gap-4 px-4 md:px-8 h-16">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-display font-semibold truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <div className="hidden md:flex items-center gap-2 glass rounded-lg px-3 py-1.5 w-72 opacity-70" title="Use the search and filters inside each admin page.">
          <Search className="h-4 w-4 text-muted-foreground"/>
          <input
            disabled
            aria-label="Global search is not enabled"
            placeholder="Use page search and filters"
            className="bg-transparent flex-1 cursor-not-allowed text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Page</span>
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
  "Random Forest selected by held-out F1-score in the latest notebook export",
  "High-risk transactions are routed to prediction history and alert review",
  "FastAPI ML service supplies fraud scores to the ASP.NET Core backend",
  "Admin model comparison reads exported JSON and CSV metrics",
  "KMeans clustering results include PCA visualizations",
  "Feature importance exports support report and review pages",
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
