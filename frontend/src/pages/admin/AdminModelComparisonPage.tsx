import { Topbar } from "@/components/layout/Topbar";
import { adminModelComparisonService } from "@/services/adminModelComparisonService";
import type { ClusteringResult, ModelComparisonItem, ModelComparisonResults } from "@/types/modelComparison";
import { Award, BarChart3, ChevronDown, ChevronUp, Database, Download, Eye, Loader2, RefreshCw, Search, Target, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type SortKey = "modelName" | "modelType" | "accuracy" | "precision" | "recall" | "f1Score" | "rocAuc";

export default function AdminModelComparisonPage() {
  const [results, setResults] = useState<ModelComparisonResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelComparisonItem | null>(null);
  const [query, setQuery] = useState("");
  const [expandedHyperparameters, setExpandedHyperparameters] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "f1Score", direction: "desc" });

  const matchingModels = useMemo(
    () => results ? filterModels(results.models, query) : [],
    [query, results],
  );
  const filteredModels = useMemo(
    () => sortModels(matchingModels, sort.key, sort.direction),
    [matchingModels, sort],
  );
  const bestModel = useMemo(
    () => results ? bestModelForScope(matchingModels, results.bestModelName) : undefined,
    [matchingModels, results],
  );
  const chartData = useMemo(() => results ? toChartData(filteredModels, results.bestModelName) : [], [filteredModels, results]);
  const hasSearch = query.trim().length > 0;

  useEffect(() => {
    void loadResults();
  }, []);

  async function loadResults() {
    setLoading(results === null);
    setRefreshing(results !== null);
    setError(null);

    try {
      setResults(await adminModelComparisonService.getModelComparison());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load model comparison results.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function toggleSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "desc" ? "asc" : "desc",
    }));
  }

  function toggleHyperparameters(modelName: string) {
    setExpandedHyperparameters((current) => ({ ...current, [modelName]: !current[modelName] }));
  }

  return (
    <>
      <Topbar
        title="Machine Learning Model Comparison"
        subtitle="Notebook evaluation summary"
      />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 space-y-4">
        <section className="glass rounded-2xl p-5">
          <div className="max-w-5xl space-y-2 text-sm text-muted-foreground leading-6">
            <p>
              This page summarizes the classifiers trained and evaluated in the Python notebook. The metrics, charts, selected hyperparameters, and best-model decision come from the exported ML results served through the backend API.
            </p>
            <p>
              The selected/exported model is converted to ONNX and served directly by the ASP.NET Core backend through ONNX Runtime for prediction requests; this page reports evaluation results and does not provide live retraining, benchmarking, enable/disable, or deployment controls.
            </p>
            <p>
              F1-score matters because fraud detection needs a practical balance between catching fraud and avoiding excessive false alerts. Recall matters because missed fraud cases become false negatives, which are usually more costly than reviewing a suspicious transaction.
            </p>
          </div>
        </section>

        {loading && <StatePanel title="Loading model comparison" message="Fetching evaluated model results from FraudGuard API." loading />}
        {!loading && error && <StatePanel title="Model comparison unavailable" message={error} destructive />}
        {!loading && !error && !results && <StatePanel title="No model comparison found" message="The API returned no model comparison payload." />}

        {!loading && !error && results && (
          <>
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <SummaryCard label={hasSearch ? "Matching models" : "Models tested"} value={`${matchingModels.length}${hasSearch ? ` / ${results.models.length}` : ""}`} icon={Database} />
              <SummaryCard label={hasSearch ? "Best matching model" : "Best model"} value={bestModel?.modelName ?? "-"} icon={Trophy} tone="best" />
              <SummaryCard label="Best F1-score" value={matchingModels.length ? formatScore(bestMetric(matchingModels, "f1Score")) : "-"} icon={BarChart3} />
              <SummaryCard label="Best recall / ROC-AUC" value={matchingModels.length ? `${formatScore(bestMetric(matchingModels, "recall"))} / ${formatOptionalScore(bestMetric(matchingModels, "rocAuc"))}` : "-"} icon={Target} />
            </section>

            <section className="glass rounded-2xl p-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search models by name, type, status, or notes"
                  className="h-10 w-full rounded-lg border border-border bg-secondary/40 pl-9 pr-10 text-sm outline-none focus:ring-1 focus:ring-primary/50"
                />
                {hasSearch && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                    aria-label="Clear model comparison search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <button onClick={() => void loadResults()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 glass hover:ring-1 hover:ring-primary/40 disabled:opacity-60">
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
                </button>
                <button onClick={() => exportJson(results)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 glass hover:ring-1 hover:ring-primary/40">
                  <Download className="h-3.5 w-3.5" /> Export JSON
                </button>
                <button onClick={() => exportCsv(results.models)} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 glass hover:ring-1 hover:ring-primary/40">
                  <Download className="h-3.5 w-3.5" /> Export CSV
                </button>
              </div>
            </section>

            {results.models.length === 0 ? (
              <StatePanel title="No chart data available" message="No evaluated models were returned for charting." />
            ) : filteredModels.length === 0 ? (
              <StatePanel title="No models match your search." message="Clear the search or try another model name, metric, status, note, or hyperparameter." />
            ) : (
              <section className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="F1 Score by model" subtitle="Best model highlighted">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData} margin={{ top: 12, right: 16, bottom: 18, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                      <XAxis dataKey="shortName" tick={{ fontSize: 11 }} interval={0} />
                      <YAxis tickFormatter={(value) => `${value}%`} width={42} tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <Tooltip content={<ScoreTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="f1Score" name="F1 Score" radius={[6, 6, 0, 0]}>
                        {chartData.map((item) => <Cell key={item.modelName} fill={item.best ? "oklch(0.72 0.18 155)" : "oklch(0.65 0.22 285)"} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Core metrics by model" subtitle="Accuracy, precision, recall, F1 score, and ROC-AUC">
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
                      <Bar dataKey="rocAuc" name="ROC-AUC" fill="oklch(0.68 0.18 35)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </section>
            )}

            <ClusteringResultsSection clusteringResults={results.clusteringResults ?? []} />

            <section className="glass max-w-full rounded-2xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="text-sm font-display font-semibold">Classifier comparison results</span>
                <span className="ml-auto text-xs text-muted-foreground">{filteredModels.length} of {results.models.length} models</span>
              </div>
              <div className="scrollbar-thin max-w-full overflow-x-auto">
                <table className="w-full text-sm min-w-[1180px]">
                  <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <Th sortable active={sort.key === "modelName"} direction={sort.direction} onClick={() => toggleSort("modelName")}>Model</Th>
                      <Th sortable active={sort.key === "modelType"} direction={sort.direction} onClick={() => toggleSort("modelType")}>Type</Th>
                      <Th sortable active={sort.key === "accuracy"} direction={sort.direction} onClick={() => toggleSort("accuracy")}>Accuracy</Th>
                      <Th sortable active={sort.key === "precision"} direction={sort.direction} onClick={() => toggleSort("precision")}>Precision</Th>
                      <Th sortable active={sort.key === "recall"} direction={sort.direction} onClick={() => toggleSort("recall")}>Recall</Th>
                      <Th sortable active={sort.key === "f1Score"} direction={sort.direction} onClick={() => toggleSort("f1Score")}>F1 Score</Th>
                      <Th sortable active={sort.key === "rocAuc"} direction={sort.direction} onClick={() => toggleSort("rocAuc")}>ROC AUC</Th>
                      <Th>Selected Hyperparameters</Th>
                      <Th>Avg Precision</Th>
                      <Th>TN</Th>
                      <Th>FP</Th>
                      <Th>FN</Th>
                      <Th>TP</Th>
                      <Th>Status</Th>
                      <Th>{""}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModels.length === 0 ? (
                      <tr className="border-t border-border">
                        <td colSpan={15} className="px-4 py-10 text-center text-muted-foreground">No models match your search.</td>
                      </tr>
                    ) : filteredModels.map((model) => {
                      const best = isBestModel(model, results.bestModelName);
                      const confusion = model.confusionMatrix;
                      const expanded = Boolean(expandedHyperparameters[model.modelName]);

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
                          <Td>
                            <SelectedHyperparameters model={model} expanded={expanded} onToggle={() => toggleHyperparameters(model.modelName)} />
                          </Td>
                          <Td>{model.averagePrecision == null ? "-" : formatScore(model.averagePrecision)}</Td>
                          <Td>{formatCount(confusion?.trueNegatives)}</Td>
                          <Td>{formatCount(confusion?.falsePositives)}</Td>
                          <Td>{formatCount(confusion?.falseNegatives)}</Td>
                          <Td>{formatCount(confusion?.truePositives)}</Td>
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
                      <Metric label="Avg precision" value={bestModel.averagePrecision == null ? "-" : formatScore(bestModel.averagePrecision)} />
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

function ClusteringResultsSection({ clusteringResults }: { clusteringResults: ClusteringResult[] }) {
  return (
    <section className="glass max-w-full rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex flex-wrap items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        <span className="text-sm font-display font-semibold">Clustering results</span>
        <span className="ml-auto text-xs text-muted-foreground">{clusteringResults.length} unsupervised result{clusteringResults.length === 1 ? "" : "s"}</span>
      </div>
      <div className="px-5 pt-4 text-sm text-muted-foreground leading-6">
        Clustering was performed without using the target label. The model groups transactions from feature patterns only; the real `isFraud` label is used afterward only to evaluate alignment with adjusted rand index when that metric is exported.
      </div>
      {clusteringResults.length === 0 ? (
        <div className="px-5 py-8 text-sm text-muted-foreground">
          No clustering results export was found in the ML results folder. Export `ml/results/clustering_results.json` or `ml/results/clustering_results.csv` to display these metrics.
        </div>
      ) : (
        <div className="scrollbar-thin mt-4 max-w-full overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>Algorithm</Th>
                <Th>Tested k values</Th>
                <Th>Best k</Th>
                <Th>Silhouette score</Th>
                <Th>Inertia</Th>
                <Th>Adjusted rand index</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {clusteringResults.map((result, index) => (
                <tr key={`${result.algorithmName}-${result.bestK ?? index}`} className={`border-t border-border hover:bg-secondary/40 ${result.isBest ? "bg-primary/5" : ""}`}>
                  <Td><span className="font-medium">{result.algorithmName}</span></Td>
                  <Td><span className="font-mono text-xs">{result.testedKValues.length ? result.testedKValues.join(", ") : "-"}</span></Td>
                  <Td><span className="font-mono">{result.bestK ?? "-"}</span></Td>
                  <Td><span className="font-mono">{formatDecimalMetric(result.silhouetteScore)}</span></Td>
                  <Td><span className="font-mono">{formatNumberMetric(result.inertia)}</span></Td>
                  <Td><span className="font-mono">{formatDecimalMetric(result.adjustedRandIndex)}</span></Td>
                  <Td>{result.isBest ? <BestBadge /> : <StatusBadge status="Tested" />}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SelectedHyperparameters({ model, expanded, onToggle }: { model: ModelComparisonItem; expanded: boolean; onToggle: () => void }) {
  const rows = buildHyperparameterRows(model, "selected")
    .filter((row) => row.value !== "Not documented");
  const visibleRows = expanded ? rows : rows.slice(0, 3);

  if (rows.length === 0) {
    return <span className="text-xs text-muted-foreground">Not documented</span>;
  }

  return (
    <div className="max-w-xs space-y-1">
      {visibleRows.map((row) => (
        <div key={row.label} className="grid grid-cols-[88px_minmax(0,1fr)] gap-2 text-xs">
          <span className="text-muted-foreground truncate">{row.label}</span>
          <span className="font-mono break-words">{row.value}</span>
        </div>
      ))}
      {rows.length > 3 && (
        <button onClick={onToggle} className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-primary hover:text-primary/80">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? "Collapse" : `Show ${rows.length - 3} more`}
        </button>
      )}
    </div>
  );
}

function StatePanel({ title, message, destructive, loading }: { title: string; message: string; destructive?: boolean; loading?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      {loading && <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />}
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
      <div onClick={(event) => event.stopPropagation()} className="glass-strong scrollbar-thin max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Classifier details</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold">{model.modelName}</h2>
              {(model.isBestModel || model.status.toLowerCase() === "best model") && <BestBadge />}
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

        <div className="mt-4">
          <DetailPanel title="Confusion matrix">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="True negatives" value={formatCount(model.confusionMatrix?.trueNegatives)} />
              <Metric label="False positives" value={formatCount(model.confusionMatrix?.falsePositives)} />
              <Metric label="False negatives" value={formatCount(model.confusionMatrix?.falseNegatives)} />
              <Metric label="True positives" value={formatCount(model.confusionMatrix?.truePositives)} />
            </div>
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

function Th({
  children,
  sortable,
  active,
  direction,
  onClick,
}: {
  children?: React.ReactNode;
  sortable?: boolean;
  active?: boolean;
  direction?: "asc" | "desc";
  onClick?: () => void;
}) {
  return (
    <th className="text-left font-medium px-4 py-3">
      {sortable ? (
        <button onClick={onClick} className="inline-flex items-center gap-1 hover:text-foreground">
          {children}
          <span className={active ? "text-primary" : "text-muted-foreground/50"}>{active ? (direction === "asc" ? "^" : "v") : "-"}</span>
        </button>
      ) : children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function formatScore(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatOptionalScore(value?: number | null) {
  return typeof value === "number" ? formatScore(value) : "-";
}

function formatPercentValue(value?: number) {
  return typeof value === "number" ? `${value.toFixed(2)}%` : "-";
}

function formatCount(value?: number) {
  return typeof value === "number" ? value.toLocaleString() : "-";
}

function formatDecimalMetric(value?: number | null) {
  return typeof value === "number" ? value.toFixed(4) : "-";
}

function formatNumberMetric(value?: number | null) {
  return typeof value === "number" ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "-";
}

function isBestModel(model: ModelComparisonItem, bestModelName: string) {
  return Boolean(model.isBestModel) || model.status.toLowerCase() === "best model" || model.modelName.toLowerCase() === bestModelName.toLowerCase();
}

function bestModelForScope(models: ModelComparisonItem[], bestModelName: string) {
  return models.find((model) => isBestModel(model, bestModelName))
    ?? [...models].sort((left, right) => right.f1Score - left.f1Score)[0];
}

function bestMetric(models: ModelComparisonItem[], key: "f1Score" | "recall" | "rocAuc") {
  return models.reduce<number | null>((best, model) => {
    const value = model[key];
    if (typeof value !== "number") {
      return best;
    }
    return best === null || value > best ? value : best;
  }, null) ?? 0;
}

function filterModels(models: ModelComparisonItem[], query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) {
    return models;
  }

  return models.filter((model) => {
    const searchable = searchableModelText(model).toLowerCase();
    return terms.every((term) => searchable.includes(term));
  });
}

function sortModels(models: ModelComparisonItem[], key: SortKey, direction: "asc" | "desc") {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...models].sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];

    if (typeof leftValue === "number" || typeof rightValue === "number") {
      return ((Number(leftValue ?? -Infinity)) - Number(rightValue ?? -Infinity)) * multiplier;
    }

    return String(leftValue ?? "").localeCompare(String(rightValue ?? "")) * multiplier;
  });
}

function exportJson(results: ModelComparisonResults) {
  downloadText("fraudguard-model-comparison.json", JSON.stringify(results, null, 2), "application/json");
}

function exportCsv(models: ModelComparisonItem[]) {
  const headers = ["Model", "Type", "Accuracy", "Precision", "Recall", "F1 Score", "ROC AUC", "Status", "Best Model"];
  const rows = models.map((model) => [
    model.modelName,
    model.modelType,
    model.accuracy,
    model.precision,
    model.recall,
    model.f1Score,
    model.rocAuc ?? "",
    model.status,
    model.isBestModel ? "true" : "false",
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  downloadText("fraudguard-model-comparison.csv", csv, "text/csv");
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadText(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function buildHyperparameterRows(model: ModelComparisonItem, group: "tested" | "selected") {
  const params = group === "selected"
    ? model.selectedHyperparameters ?? model.hyperparameters?.selected ?? {}
    : model.hyperparameters?.tested ?? {};
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

  const confusion = model.confusionMatrix
    ? ` Confusion matrix: TN ${formatCount(model.confusionMatrix.trueNegatives)}, FP ${formatCount(model.confusionMatrix.falsePositives)}, FN ${formatCount(model.confusionMatrix.falseNegatives)}, TP ${formatCount(model.confusionMatrix.truePositives)}.`
    : "";

  return `${status} Recorded test metrics: accuracy ${formatScore(model.accuracy)}, precision ${formatScore(model.precision)}, recall ${formatScore(model.recall)}, F1 score ${formatScore(model.f1Score)}, ROC AUC ${model.rocAuc == null ? "Not documented" : formatScore(model.rocAuc)}, and average precision ${model.averagePrecision == null ? "Not documented" : formatScore(model.averagePrecision)}.${confusion}`;
}

function searchableModelText(model: ModelComparisonItem) {
  const selectedRows = buildHyperparameterRows(model, "selected");
  const testedRows = buildHyperparameterRows(model, "tested");
  const confusion = model.confusionMatrix;

  return [
    model.modelName,
    model.classifierName,
    model.modelType,
    model.status,
    model.isBestModel ? "best selected best model" : "tested trained evaluated",
    model.shortDescription,
    buildResultExplanation(model),
    model.accuracy != null ? `accuracy ${formatScore(model.accuracy)}` : "",
    model.precision != null ? `precision ${formatScore(model.precision)}` : "",
    model.recall != null ? `recall ${formatScore(model.recall)}` : "",
    model.f1Score != null ? `f1 f1-score ${formatScore(model.f1Score)}` : "",
    model.rocAuc != null ? `roc auc roc-auc ${formatScore(model.rocAuc)}` : "",
    model.averagePrecision != null ? `average precision ${formatScore(model.averagePrecision)}` : "",
    confusion ? `true negatives ${confusion.trueNegatives} false positives ${confusion.falsePositives} false negatives ${confusion.falseNegatives} true positives ${confusion.truePositives}` : "",
    ...selectedRows.flatMap((row) => [row.label, row.value]),
    ...testedRows.flatMap((row) => [row.label, row.value]),
  ].filter(Boolean).join(" ");
}

function toChartData(models: ModelComparisonItem[], bestModelName: string) {
  return models.map((model) => ({
    modelName: model.modelName,
    shortName: shortModelName(model.modelName),
    accuracy: toPercent(model.accuracy),
    precision: toPercent(model.precision),
    recall: toPercent(model.recall),
    f1Score: toPercent(model.f1Score),
    rocAuc: model.rocAuc == null ? null : toPercent(model.rocAuc),
    averagePrecision: model.averagePrecision == null ? null : toPercent(model.averagePrecision),
    best: isBestModel(model, bestModelName),
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
