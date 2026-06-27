export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/70 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-4 px-4 md:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-lg font-semibold md:text-xl">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
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
    <div className="overflow-hidden border-t border-border bg-card/30">
      <div className="flex animate-ticker gap-12 whitespace-nowrap py-1.5 text-xs text-muted-foreground">
        {[...tickerItems, ...tickerItems].map((item, index) => (
          <span key={index} className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
