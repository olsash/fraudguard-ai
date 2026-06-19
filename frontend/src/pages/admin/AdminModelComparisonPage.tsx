import { Topbar } from "@/components/layout/Topbar";
import { adminModelComparisonService } from "@/services/adminModelComparisonService";
import type { ModelComparisonItem, ModelComparisonResults } from "@/types/modelComparison";
import { Award, BarChart3, Database, Eye, Loader2, Target, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function AdminModelComparisonPage() {
  const [results, setResults] = useState<ModelComparisonResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelComparisonItem | null>(null);

  const bestModel = useMemo(
    () => results?.models.find((model) => isBestModel(model, results.bestModelName)),
    [results],
  );
  const chartData = useMemo(() => results ? toChartData(results) : [], [results]);

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

            {results.models.length === 0 ? (
              <StatePanel title="No chart data available" message="No evaluated models were returned for charting." />
            ) : (
              <section className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="F1 Score by model" subtitle="Best model highlighted">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 12, right: 16, bottom: 18, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="shortName" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis tickFormatter={(value) => `${value}%`} width={42} tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip content={<ScoreTooltip />} />
                      <Bar dataKey="f1Score" name="F1 Score" radius={[6, 6, 0, 0]}>
                        {chartData.map((item) => <Cell key={item.modelName} fill={item.best ? "oklch(0.72 0.18 155)" : "oklch(0.65 0.22 285)"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Core metrics by model" subtitle="Accuracy, precision, recall, and F1 score">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 12, right: 16, bottom: 18, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="shortName" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis tickFormatter={(value) => `${value}%`} width={42} tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip content={<ScoreTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="accuracy" name="Accuracy" fill="oklch(0.65 0.22 285)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="precision" name="Precision" fill="oklch(0.78 0.18 200)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="recall" name="Recall" fill="oklch(0.8 0.17 75)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="f1Score" name="F1 Score" fill="oklch(0.72 0.18 155)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>
            )}

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
                      <Th />
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
                          <Td>
                            <button
                              onClick={() => setSelectedModel(model)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs text-foreground hover:ring-1 hover:ring-primary/40"
                            >
                              <Eye className="h-3.5 w-3.5" /> View Details
                            </button>
                          </Td>
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
      {selectedModel && <ModelDetailsModal model={selectedModel} onClose={() => setSelectedModel(null)} />}
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

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <div>
          <h2 className="text-sm font-display font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="h-[260px]">{children}</div>
    </section>
  );
}

function ScoreTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="glass-strong rounded-lg border border-border p-3 text-xs shadow-xl">
      <p className="mb-2 font-semibold">{label}</p>
      <div className="space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-mono font-semibold">{formatPercentValue(item.value)}</span>
          </div>
        ))}
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

function ModelDetailsModal({ model, onClose }: { model: ModelComparisonItem; onClose: () => void }) {
  const testedRows = buildHyperparameterRows(model, "tested");
  const selectedRows = buildHyperparameterRows(model, "selected");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="glass-strong rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Classifier details</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold">{model.modelName}</h2>
              {model.status.toLowerCase() === "best model" && <BestBadge />}
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{model.modelType}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <DetailPanel title="Tested hyperparameters">
            <HyperparameterList rows={testedRows} />
          </DetailPanel>
          <DetailPanel title="Final selected hyperparameters">
            <HyperparameterList rows={selectedRows} />
          </DetailPanel>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <DetailPanel title="Model description">
            <p className="text-sm text-muted-foreground leading-6">{model.shortDescription || "Not documented"}</p>
          </DetailPanel>
          <DetailPanel title="Result explanation">
            <p className="text-sm text-muted-foreground leading-6">{buildResultExplanation(model)}</p>
          </DetailPanel>
        </div>
      </div>
    </div>
  );
}

function DetailPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-lg p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function HyperparameterList({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[minmax(120px,0.8fr)_minmax(0,1.2fr)] gap-3 rounded-md bg-secondary/40 p-2 text-sm">
          <p className="text-xs uppercase text-muted-foreground">{row.label}</p>
          <p className="font-mono text-xs break-words">{row.value}</p>
        </div>
      ))}
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

function formatPercentValue(value?: number) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : "-";
}

function isBestModel(model: ModelComparisonItem, bestModelName: string) {
  return model.status.toLowerCase() === "best model" || model.modelName.toLowerCase() === bestModelName.toLowerCase();
}

function buildHyperparameterRows(model: ModelComparisonItem, group: "tested" | "selected") {
  const params = model.hyperparameters?.[group] ?? {};
  const keys = preferredHyperparameterKeys(model);
  const documentedKeys = Object.keys(params);
  const orderedKeys = [...keys, ...documentedKeys.filter((key) => !keys.includes(key))];

  return orderedKeys.map((key) => ({
    label: formatHyperparameterLabel(key),
    value: formatHyperparameterValue(params[key]),
  }));
}

function preferredHyperparameterKeys(model: ModelComparisonItem) {
  const name = model.modelName.toLowerCase();
  const type = model.modelType.toLowerCase();

  if (name.includes("logistic") || type.includes("logistic")) {
    return ["C", "solver"];
  }

  if (name.includes("knn") || type.includes("kneighbors")) {
    return ["n_neighbors", "weights", "metric"];
  }

  if (name.includes("decision tree") || type.includes("decisiontree")) {
    return ["max_depth", "criterion", "min_samples_split"];
  }

  if (name.includes("random forest") || type.includes("randomforest")) {
    return ["n_estimators", "max_depth", "criterion", "min_samples_split"];
  }

  if (name.includes("neural") || type.includes("mlp")) {
    return ["hidden_layer_sizes", "activation", "solver", "learning_rate_init"];
  }

  return [];
}

function formatHyperparameterLabel(key: string) {
  const labels: Record<string, string> = {
    C: "C",
    n_neighbors: "n_neighbors",
    hidden_layer_sizes: "hidden_layer_sizes",
    learning_rate_init: "learning_rate_init",
    max_iter: "max_iter",
    random_state: "random_state",
    class_weight: "class_weight",
    min_samples_split: "min_samples_split",
    n_estimators: "n_estimators",
    max_depth: "max_depth",
  };

  return labels[key] ?? key;
}

function formatHyperparameterValue(value: unknown): string {
  if (value === undefined) {
    return "Not documented";
  }

  if (value === null) {
    return "None";
  }

  if (Array.isArray(value)) {
    return value.map((item) => Array.isArray(item) ? `[${item.map(formatHyperparameterValue).join(", ")}]` : formatHyperparameterValue(item)).join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function buildResultExplanation(model: ModelComparisonItem) {
  const status = model.status.toLowerCase() === "best model"
    ? "This model was selected as the best model in the exported comparison."
    : "This model was evaluated in the exported comparison but was not selected as the best model.";

  return `${status} Recorded test metrics: accuracy ${formatScore(model.accuracy)}, precision ${formatScore(model.precision)}, recall ${formatScore(model.recall)}, F1 score ${formatScore(model.f1Score)}, and ROC AUC ${model.rocAuc == null ? "Not documented" : formatScore(model.rocAuc)}.`;
}

function toChartData(results: ModelComparisonResults) {
  return results.models.map((model) => ({
    modelName: model.modelName,
    shortName: shortModelName(model.modelName),
    accuracy: toPercent(model.accuracy),
    precision: toPercent(model.precision),
    recall: toPercent(model.recall),
    f1Score: toPercent(model.f1Score),
    best: isBestModel(model, results.bestModelName),
  }));
}

function toPercent(value: number) {
  return Number((value * 100).toFixed(2));
}

function shortModelName(modelName: string) {
  return modelName
    .replace("Logistic Regression", "Logistic")
    .replace("Decision Tree", "Tree")
    .replace("Random Forest", "Forest")
    .replace("Neural Network", "Neural");
}
