import { StatCard } from "@/components/common/StatCard";
import { FraudSelect } from "@/components/common/FraudSelect";
import { Topbar } from "@/components/layout/Topbar";
import { adminPredictionService } from "@/services/adminPredictionService";
import type { AdminFilters, AdminPrediction, AdminPredictionDetail } from "@/types/admin";
import type { TransactionStatus } from "@/types/transaction";
import { AlertTriangle, BrainCircuit, ChevronRight, Download, Gauge, Loader2, Search, ShieldCheck, ShieldQuestion, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RiskBar, StatusBadge, Td, Th } from "@/pages/transactions/TransactionsPage";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/formatters";

const transactionTypes = ["all", "CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"] as const;
const emptyFilters: AdminFilters = { status: "all", riskLevel: "all", predictionResult: "all", transactionType: "all" };

export default function AdminPredictionsPage() {
  const [predictions, setPredictions] = useState<AdminPrediction[]>([]);
  const [filters, setFilters] = useState<AdminFilters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminPredictionDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const summary = useMemo(() => buildSummary(predictions), [predictions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPredictions(), 250);
    return () => window.clearTimeout(timeout);
  }, [filters.search, filters.status, filters.riskLevel, filters.predictionResult, filters.transactionType, filters.fromDate, filters.toDate]);

  async function loadPredictions() {
    setLoading(true);
    setError(null);

    try {
      setPredictions(await adminPredictionService.getPredictions(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load predictions.");
    } finally {
      setLoading(false);
    }
  }

  async function openDetails(id: number) {
    setDetailsLoading(true);
    try {
      setSelected(await adminPredictionService.getPredictionById(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load prediction details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function exportPredictions() {
    setExporting(true);
    setError(null);

    try {
      const file = await adminPredictionService.exportPredictions(filters);
      downloadBlob(file, `admin-prediction-history-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Prediction history exported");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to export prediction history.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <Topbar title="Predictions" subtitle="Prediction history across the platform" />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 space-y-4">
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Predictions" value={summary.total.toLocaleString()} icon={BrainCircuit} />
          <StatCard label="Low Risk" value={summary.low.toLocaleString()} icon={ShieldCheck} tone="success" />
          <StatCard label="Medium / Review" value={summary.medium.toLocaleString()} icon={ShieldQuestion} tone="warning" />
          <StatCard label="High / Fraud" value={summary.high.toLocaleString()} icon={AlertTriangle} tone="destructive" />
          <StatCard label="Average Risk Score" value={`${summary.averageRisk}/100`} icon={Gauge} tone="primary" />
        </section>

        <Toolbar filters={filters} exporting={exporting} onExport={() => void exportPredictions()} onChange={setFilters} />

        {loading && <StatePanel title="Loading predictions" message="Fetching prediction history from FraudGuard API." />}
        {!loading && error && <StatePanel title="Predictions unavailable" message={error} destructive />}
        {!loading && !error && (
          <div className="glass max-w-full rounded-2xl overflow-hidden">
            <div className="scrollbar-thin max-w-full overflow-x-auto">
              <table className="w-full text-sm min-w-[1180px]">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><Th>Prediction ID</Th><Th>User</Th><Th>Transaction</Th><Th>Type</Th><Th>Amount</Th><Th>Prediction Result</Th><Th>Risk</Th><Th>Score</Th><Th>Created</Th><Th /></tr>
                </thead>
                <tbody>
                  {predictions.length === 0 ? (
                    <tr className="border-t border-border"><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">No predictions found.</td></tr>
                  ) : predictions.map((prediction) => (
                    <tr key={prediction.id} onClick={() => void openDetails(prediction.id)} className="border-t border-border hover:bg-secondary/40 cursor-pointer">
                      <Td><span className="font-mono text-xs">PR-{prediction.id}</span></Td>
                      <Td>{prediction.userName}</Td>
                      <Td>{prediction.transactionMerchant ?? (prediction.transactionId ? `TX-${prediction.transactionId}` : "Manual prediction")}</Td>
                      <Td><span className="font-mono text-xs">{prediction.transactionType}</span></Td>
                      <Td className="font-mono font-semibold">{formatCurrency(prediction.amount, prediction.currency)}</Td>
                      <Td><StatusBadge s={prediction.status} /></Td>
                      <Td><RiskBar value={prediction.riskScore} /></Td>
                      <Td className="font-mono">{prediction.riskScore}/100</Td>
                      <Td className="text-xs text-muted-foreground">{formatDateTime(prediction.createdAt)}</Td>
                      <Td><ChevronRight className="h-4 w-4 text-muted-foreground" /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      {detailsLoading && !selected && <DetailsLoading />}
      {selected && <PredictionModal prediction={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function Toolbar({
  filters,
  exporting,
  onExport,
  onChange,
}: {
  filters: AdminFilters;
  exporting: boolean;
  onExport: () => void;
  onChange: (filters: AdminFilters) => void;
}) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 glass rounded-lg px-3 py-2 flex-1 min-w-[240px]">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={filters.search ?? ""} onChange={(e) => onChange({ ...filters, search: e.target.value })} placeholder="Search user, transaction ID, prediction ID, merchant..." className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="flex items-center gap-1">
        {(["all", "safe", "review", "fraud"] as Array<"all" | TransactionStatus>).map((status) => (
          <button key={status} onClick={() => onChange({ ...filters, status })}
            className={`text-xs px-3 py-1.5 rounded-lg capitalize ${filters.status === status ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}>
            {status}
          </button>
        ))}
      </div>
      <FraudSelect
        value={filters.predictionResult ?? "all"}
        onValueChange={(value) => onChange({ ...filters, predictionResult: value as AdminFilters["predictionResult"] })}
        options={[
          { value: "all", label: "All results" },
          { value: "fraud", label: "Fraud" },
          { value: "not_fraud", label: "Not fraud" },
        ]}
        ariaLabel="Prediction result"
        triggerClassName="h-9 min-h-9 w-[135px] px-3 py-2 text-xs"
      />
      <FraudSelect
        value={filters.transactionType ?? "all"}
        onValueChange={(value) => onChange({ ...filters, transactionType: value as AdminFilters["transactionType"] })}
        options={transactionTypes.map((type) => ({ value: type, label: type === "all" ? "All types" : type }))}
        ariaLabel="Transaction type"
        triggerClassName="h-9 min-h-9 w-[140px] px-3 py-2 text-xs"
      />
      <input type="date" value={filters.fromDate ?? ""} onChange={(e) => onChange({ ...filters, fromDate: e.target.value || undefined })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <input type="date" value={filters.toDate ?? ""} onChange={(e) => onChange({ ...filters, toDate: e.target.value || undefined })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <FraudSelect
        value={filters.riskLevel ?? "all"}
        onValueChange={(value) => onChange({ ...filters, riskLevel: value as AdminFilters["riskLevel"] })}
        options={[
          { value: "all", label: "All risk" },
          { value: "low", label: "Low risk" },
          { value: "medium", label: "Review risk" },
          { value: "high", label: "High risk" },
        ]}
        ariaLabel="Risk level"
        triggerClassName="h-9 min-h-9 w-[130px] px-3 py-2 text-xs"
      />
      <button
        type="button"
        onClick={onExport}
        disabled={exporting}
        className="glass rounded-lg px-3 py-2 text-xs hover:ring-1 hover:ring-primary/40 disabled:opacity-60 inline-flex items-center gap-2"
      >
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Export CSV
      </button>
    </div>
  );
}

function PredictionModal({ prediction, onClose }: { prediction: AdminPredictionDetail; onClose: () => void }) {
  const transaction = prediction.transaction;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="glass-strong scrollbar-thin max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Prediction PR-{prediction.id}</p>
            <p className="font-display font-semibold text-lg">{prediction.transactionMerchant}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="Transaction Information">
            <Metric label="Transaction ID" value={transaction?.id ? `TX-${transaction.id}` : "Not linked"} />
            <Metric label="Merchant" value={transaction?.merchant ?? prediction.transactionMerchant} />
            <Metric label="Country" value={transaction?.country ?? prediction.country} />
            <Metric label="Category" value={transaction?.category ?? prediction.category} />
            <Metric label="Amount" value={formatCurrency(transaction?.amount ?? prediction.amount, transaction?.currency ?? prediction.currency)} />
            <Metric label="Currency" value={transaction?.currency ?? prediction.currency} />
            <Metric label="Transaction Type" value={transaction?.transactionType ?? prediction.transactionType} />
            <Metric label="Date" value={formatDateTime(transaction?.createdAt ?? prediction.createdAt)} />
          </Panel>

          <Panel title="User Information">
            <Metric label="User ID" value={prediction.user.id} />
            <Metric label="User Name" value={prediction.user.name} />
            <Metric label="Email" value={prediction.user.email ?? "Not available"} />
          </Panel>

          <Panel title="Prediction Result">
            <Metric label="Risk Score" value={`${prediction.riskScore}/100`} />
            <Metric label="Risk Level" value={prediction.riskLevel} />
            <Metric label="Final Status" value={<StatusBadge s={prediction.status} />} />
            <Metric label="Model Name" value={prediction.modelName} />
            <Metric label="Confidence" value={`${Math.round(prediction.confidence * 100)}%`} />
            <Metric label="Suggested Action" value={prediction.suggestedAction} />
          </Panel>

          <Panel title="Linked Alert">
            {prediction.alert ? (
              <>
                <Metric label="Alert ID" value={`AL-${prediction.alert.id}`} />
                <Metric label="Severity" value={prediction.alert.severity} />
                <Metric label="Status" value={prediction.alert.status} />
                <Metric label="Created" value={formatDateTime(prediction.alert.createdAt)} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No alert generated for this prediction.</p>
            )}
          </Panel>
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-4">
          <section className="glass rounded-lg p-4">
            <h3 className="text-sm font-semibold">Why This Prediction?</h3>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {normalizedFactors(prediction).map((factor) => <li key={factor}>- {factor}</li>)}
            </ul>
          </section>
          <section className="glass rounded-lg p-4">
            <h3 className="text-sm font-semibold">Model Decision Summary</h3>
            <p className="mt-3 text-sm text-muted-foreground">{prediction.decisionSummary}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

function normalizedFactors(prediction: AdminPredictionDetail) {
  const factors = prediction.factors.map(formatExplanationFactor).filter(Boolean);
  if (factors.length > 0) return factors;

  return ["No explanation factors were returned for this prediction."];
}

function downloadBlob(file: Blob, fileName: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildSummary(predictions: AdminPrediction[]) {
  return {
    total: predictions.length,
    low: predictions.filter((prediction) => prediction.riskScore < 40).length,
    medium: predictions.filter((prediction) => prediction.riskScore >= 40 && prediction.riskScore < 70).length,
    high: predictions.filter((prediction) => prediction.riskScore >= 70).length,
    averageRisk: predictions.length ? Math.round(predictions.reduce((sum, prediction) => sum + prediction.riskScore, 0) / predictions.length) : 0,
  };
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="glass rounded-lg p-4 space-y-2"><h3 className="text-sm font-semibold">{title}</h3>{children}</section>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="text-sm"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium break-words">{value}</p></div>;
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

function DetailsLoading() {
  return <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4"><div className="glass rounded-2xl p-6 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin text-primary" /> Loading details...</div></div>;
}


function formatExplanationFactor(reason: string) {
  const delimiter = reason.indexOf("|");
  return delimiter === -1 ? reason : reason.slice(delimiter + 1).trim();
}

function formatDateTime(value: string) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";
}
