import { StatCard } from "@/components/common/StatCard";
import { Topbar } from "@/components/layout/Topbar";
import { adminPredictionService } from "@/services/adminPredictionService";
import type { AdminFilters, AdminPrediction, AdminPredictionDetail } from "@/types/admin";
import type { TransactionStatus } from "@/types/transaction";
import { AlertTriangle, BrainCircuit, ChevronRight, Gauge, Loader2, Search, ShieldCheck, ShieldQuestion, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RiskBar, StatusBadge, Td, Th } from "@/pages/transactions/TransactionsPage";
import { toast } from "sonner";

const emptyFilters: AdminFilters = { status: "all", riskLevel: "all" };

export default function AdminPredictionsPage() {
  const [predictions, setPredictions] = useState<AdminPrediction[]>([]);
  const [filters, setFilters] = useState<AdminFilters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminPredictionDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const summary = useMemo(() => buildSummary(predictions), [predictions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPredictions(), 250);
    return () => window.clearTimeout(timeout);
  }, [filters.search, filters.status, filters.riskLevel, filters.fromDate, filters.toDate]);

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

  return (
    <>
      <Topbar title="Predictions" subtitle="Prediction history across the platform" />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total Predictions" value={summary.total.toLocaleString()} icon={BrainCircuit} />
          <StatCard label="Low Risk" value={summary.low.toLocaleString()} icon={ShieldCheck} tone="success" />
          <StatCard label="Medium / Review" value={summary.medium.toLocaleString()} icon={ShieldQuestion} tone="warning" />
          <StatCard label="High / Fraud" value={summary.high.toLocaleString()} icon={AlertTriangle} tone="destructive" />
          <StatCard label="Average Risk Score" value={`${summary.averageRisk}/100`} icon={Gauge} tone="primary" />
        </section>

        <Toolbar filters={filters} onChange={setFilters} />

        {loading && <StatePanel title="Loading predictions" message="Fetching prediction history from FraudGuard API." />}
        {!loading && error && <StatePanel title="Predictions unavailable" message={error} destructive />}
        {!loading && !error && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1080px]">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><Th>Prediction ID</Th><Th>Transaction</Th><Th>User</Th><Th>Country</Th><Th>Amount</Th><Th>Risk</Th><Th>Risk Score</Th><Th>Status</Th><Th>Created</Th><Th /></tr>
                </thead>
                <tbody>
                  {predictions.length === 0 ? (
                    <tr className="border-t border-border"><td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">No predictions found.</td></tr>
                  ) : predictions.map((prediction) => (
                    <tr key={prediction.id} onClick={() => void openDetails(prediction.id)} className="border-t border-border hover:bg-secondary/40 cursor-pointer">
                      <Td><span className="font-mono text-xs">PR-{prediction.id}</span></Td>
                      <Td>{prediction.transactionMerchant ?? (prediction.transactionId ? `TX-${prediction.transactionId}` : prediction.transactionType)}</Td>
                      <Td>{prediction.userName}</Td>
                      <Td>{prediction.country}</Td>
                      <Td className="font-mono font-semibold">{formatCurrency(prediction.amount, prediction.currency)}</Td>
                      <Td><RiskBar value={prediction.riskScore} /></Td>
                      <Td className="font-mono">{prediction.riskScore}/100</Td>
                      <Td><StatusBadge s={prediction.status} /></Td>
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

function Toolbar({ filters, onChange }: { filters: AdminFilters; onChange: (filters: AdminFilters) => void }) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 glass rounded-lg px-3 py-2 flex-1 min-w-[240px]">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={filters.search ?? ""} onChange={(e) => onChange({ ...filters, search: e.target.value })} placeholder="Search transaction, merchant, user, country..." className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="flex items-center gap-1">
        {(["all", "safe", "review", "fraud"] as Array<"all" | TransactionStatus>).map((status) => (
          <button key={status} onClick={() => onChange({ ...filters, status })}
            className={`text-xs px-3 py-1.5 rounded-lg capitalize ${filters.status === status ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}>
            {status}
          </button>
        ))}
      </div>
      <input type="date" value={filters.fromDate ?? ""} onChange={(e) => onChange({ ...filters, fromDate: e.target.value || undefined })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <input type="date" value={filters.toDate ?? ""} onChange={(e) => onChange({ ...filters, toDate: e.target.value || undefined })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <select value={filters.riskLevel ?? "all"} onChange={(event) => onChange({ ...filters, riskLevel: event.target.value as AdminFilters["riskLevel"] })} className="glass rounded-lg px-3 py-2 text-xs bg-background outline-none">
        <option value="all">All risk</option>
        <option value="low">Low risk</option>
        <option value="medium">Review risk</option>
        <option value="high">High risk</option>
      </select>
    </div>
  );
}

function PredictionModal({ prediction, onClose }: { prediction: AdminPredictionDetail; onClose: () => void }) {
  const transaction = prediction.transaction;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="glass-strong rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
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

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value ?? 0);
}

function formatExplanationFactor(reason: string) {
  const delimiter = reason.indexOf("|");
  return delimiter === -1 ? reason : reason.slice(delimiter + 1).trim();
}

function formatDateTime(value: string) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";
}
