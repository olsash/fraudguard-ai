import { Topbar } from "@/components/layout/Topbar";
import { adminModelComparisonService } from "@/services/adminModelComparisonService";
import type { ModelComparisonItem, ModelComparisonResults } from "@/types/modelComparison";
import { Award, BarChart3, Database, Loader2, Target, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function AdminModelComparisonPage() {
  const [results, setResults] = useState<ModelComparisonResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bestModel = useMemo(
    () => results?.models.find((model) => isBestModel(model, results.bestModelName)),
    [results],
  );

  useEffect(() => {
    void loadResults();
  }, []);

  async function loadResults() {
    setLoading(true);
    setError(null);

    try {
      setResults(await adminModelComparisonService.getModelComparison());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load model comparison results.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Topbar
        title="Machine Learning Model Comparison"
        subtitle="Notebook evaluation summary"
      />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <section className="glass rounded-2xl p-5">
          <p className="max-w-4xl text-sm text-muted-foreground leading-6">
            This page summarizes the classifiers tested during the fraud detection experiments. The full technical details are available in the notebook, while this page shows the main comparison results.
          </p>
        </section>

        {loading && <StatePanel title="Loading model comparison" message="Fetching evaluated model results from FraudGuard API." />}
        {!loading && error && <StatePanel title="Model comparison unavailable" message={error} destructive />}
        {!loading && !error && !results && <StatePanel title="No model comparison found" message="The API returned no model comparison payload." />}

        {!loading && !error && results && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryCard label="Dataset name" value={results.datasetName} icon={Database} />
              <SummaryCard label="Problem type" value={results.problemType} icon={BarChart3} />
              <SummaryCard label="Target variable" value={results.targetVariable} icon={Target} />
              <SummaryCard label="Best model used for prediction" value={results.bestModelName} icon={Trophy} tone="best" />
            </section>

            <section className="glass rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-display font-semibold">Classifier comparison results</span>
                <span className="ml-auto text-xs text-muted-foreground">{results.models.length} models tested</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[980px]">
                  <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <Th>Model</Th>
                      <Th>Type</Th>
                      <Th>Accuracy</Th>
                      <Th>Precision</Th>
                      <Th>Recall</Th>
                      <Th>F1 Score</Th>
                      <Th>ROC AUC</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.models.map((model) => {
                      const best = isBestModel(model, results.bestModelName);

                      return (
                        <tr key={model.modelName} className={`border-t border-border hover:bg-secondary/40 ${best ? "bg-primary/5" : ""}`}>
                          <Td>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{model.modelName}</span>
                              {best && <BestBadge />}
                            </div>
                            <p className="mt-1 max-w-md text-xs text-muted-foreground">{model.shortDescription}</p>
                          </Td>
                          <Td><span className="font-mono text-xs">{model.modelType}</span></Td>
                          <Td>{formatScore(model.accuracy)}</Td>
                          <Td>{formatScore(model.precision)}</Td>
                          <Td>{formatScore(model.recall)}</Td>
                          <Td>{formatScore(model.f1Score)}</Td>
                          <Td>{model.rocAuc == null ? "-" : formatScore(model.rocAuc)}</Td>
                          <Td>{best ? <BestBadge /> : <StatusBadge status={model.status} />}</Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="glass rounded-2xl p-5">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" />
                <h2 className="font-display font-semibold">Why this model was selected</h2>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <p className="text-sm text-muted-foreground leading-6">{results.bestModelReason}</p>
                {bestModel && (
                  <div className="glass rounded-lg p-4">
                    <p className="text-xs uppercase text-muted-foreground">Selected model</p>
                    <p className="mt-1 font-display font-semibold">{bestModel.modelName}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <Metric label="F1" value={formatScore(bestModel.f1Score)} />
                      <Metric label="Recall" value={formatScore(bestModel.recall)} />
                      <Metric label="Precision" value={formatScore(bestModel.precision)} />
                      <Metric label="ROC AUC" value={bestModel.rocAuc == null ? "-" : formatScore(bestModel.rocAuc)} />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone?: "best" }) {
  return (
    <div className={`glass rounded-2xl p-5 ${tone === "best" ? "ring-1 ring-primary/40" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center shrink-0">
          <Icon className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 font-display font-semibold break-words">{value}</p>
        </div>
      </div>
    </div>
  );
}

function BestBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-success/15 px-2 py-1 text-[10px] uppercase text-success">
      <Trophy className="h-3 w-3" /> Best Model
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className="rounded bg-secondary/70 px-2 py-1 text-[10px] uppercase text-muted-foreground">{status}</span>;
}

function StatePanel({ title, message, destructive }: { title: string; message: string; destructive?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      {!destructive && <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />}
      <h2 className="mt-4 text-xl font-display font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/40 p-2">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-mono font-semibold">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-4 py-3">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function formatScore(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function isBestModel(model: ModelComparisonItem, bestModelName: string) {
  return model.status.toLowerCase() === "best model" || model.modelName.toLowerCase() === bestModelName.toLowerCase();
}
