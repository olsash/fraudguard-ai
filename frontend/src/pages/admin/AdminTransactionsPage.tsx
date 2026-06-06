import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/common/StatCard";
import { predictionService } from "@/services/predictionService";
import { transactionService } from "@/services/transactionService";
import type { Transaction, TransactionFilters, TransactionStatus, TransactionSummary } from "@/types/transaction";
import { AlertTriangle, ChevronRight, Loader2, Receipt, Search, ShieldCheck, ShieldQuestion, Wallet, X, Gauge, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RiskBar, StatusBadge, Td, Th } from "@/pages/transactions/TransactionsPage";
import { toast } from "sonner";

export default function AdminTx() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<TransactionSummary | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({ status: "all" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [updating, setUpdating] = useState(false);
  const [predictingId, setPredictingId] = useState<number | null>(null);
  const [riskFilter, setRiskFilter] = useState<"all" | "low" | "medium" | "high">("all");

  const visibleTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      if (transaction.riskScore == null) return riskFilter === "all";
      if (riskFilter === "low") return transaction.riskScore < 40;
      if (riskFilter === "medium") return transaction.riskScore >= 40 && transaction.riskScore < 70;
      if (riskFilter === "high") return transaction.riskScore >= 70;
      return true;
    });
  }, [transactions, riskFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadTransactions(), 250);
    return () => window.clearTimeout(timeout);
  }, [filters.search, filters.status, filters.fromDate, filters.toDate]);

  async function loadTransactions() {
    setLoading(true);
    setError(null);

    try {
      const [rows, totals] = await Promise.all([
        transactionService.getTransactions(filters),
        transactionService.getTransactionSummary(filters),
      ]);
      setTransactions(rows);
      setSummary(totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load transactions. Check that the backend API is running.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(status: TransactionStatus) {
    if (!selected) return;
    setUpdating(true);

    try {
      const updated = await transactionService.updateTransactionStatus(selected.id, status);
      setSelected(updated);
      setTransactions((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSummary(await transactionService.getTransactionSummary(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update transaction status.");
    } finally {
      setUpdating(false);
    }
  }

  async function predictTransaction(transactionId: number) {
    setPredictingId(transactionId);
    setError(null);

    try {
      await predictionService.predictTransaction(transactionId);
      toast.success("Prediction saved successfully");
      await loadTransactions();
      if (selected?.id === transactionId) {
        setSelected(await transactionService.getTransactionById(transactionId));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to run prediction.");
    } finally {
      setPredictingId(null);
    }
  }

  return (
    <>
      <Topbar title="Transactions" subtitle="All transactions across the platform" />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <section className="grid grid-cols-2 lg:grid-cols-7 gap-4">
          <StatCard label="Total Transactions" value={(summary?.totalTransactions ?? 0).toLocaleString()} icon={Receipt} />
          <StatCard label="Pending" value={(summary?.pendingCount ?? 0).toLocaleString()} icon={Loader2} tone="primary" />
          <StatCard label="Safe" value={(summary?.safeCount ?? 0).toLocaleString()} icon={ShieldCheck} tone="success" />
          <StatCard label="Review" value={(summary?.reviewCount ?? 0).toLocaleString()} icon={ShieldQuestion} tone="warning" />
          <StatCard label="Fraud" value={(summary?.fraudCount ?? 0).toLocaleString()} icon={AlertTriangle} tone="destructive" />
          <StatCard label="Total Amount" value={formatCurrency(summary?.totalAmount ?? 0)} icon={Wallet} tone="violet" />
          <StatCard label="Average Risk" value={`${summary?.averageRisk ?? 0}/100`} icon={Gauge} tone="primary" />
        </section>

        <Toolbar filters={filters} riskFilter={riskFilter} onRiskChange={setRiskFilter} onChange={setFilters} />

        {loading && <StatePanel title="Loading transactions" message="Fetching platform transactions from FraudGuard API." />}
        {!loading && error && <StatePanel title="Transactions unavailable" message={error} destructive />}
        {!loading && !error && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1080px]">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><Th>ID</Th><Th>Merchant</Th><Th>User</Th><Th>Country</Th><Th>Amount</Th><Th>Risk</Th><Th>Status</Th><Th>Time</Th><Th /></tr>
                </thead>
                <tbody>
                  {visibleTransactions.length === 0 ? (
                    <tr className="border-t border-border">
                      <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No transactions found</td>
                    </tr>
                  ) : visibleTransactions.map((transaction) => (
                    <tr key={transaction.id} onClick={() => setSelected(transaction)} className="border-t border-border hover:bg-secondary/40 cursor-pointer">
                      <Td><span className="font-mono text-xs">TX-{transaction.id}</span></Td>
                      <Td>{transaction.merchant}</Td>
                      <Td>{transaction.userName ?? `User ${transaction.userId}`}</Td>
                      <Td>{transaction.country}</Td>
                      <Td className="font-mono font-semibold">{formatCurrency(transaction.amount, transaction.currency)}</Td>
                      <Td><RiskBar value={transaction.riskScore} /></Td>
                      <Td><StatusBadge s={transaction.status} /></Td>
                      <Td className="text-xs text-muted-foreground">{formatDateTime(transaction.createdAt)}</Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void predictTransaction(transaction.id);
                            }}
                            disabled={predictingId === transaction.id}
                            className="rounded px-2 py-1 text-xs glass hover:ring-1 hover:ring-primary/40 disabled:opacity-60"
                          >
                            {predictingId === transaction.id ? "Scoring..." : transaction.latestPredictionId ? "Re-analyze" : "Run Analysis"}
                          </button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      {selected && (
        <AdminTransactionModal
          transaction={selected}
          updating={updating}
          predicting={predictingId === selected.id}
          onClose={() => setSelected(null)}
          onStatusChange={(status) => void updateStatus(status)}
          onPredict={() => void predictTransaction(selected.id)}
        />
      )}
    </>
  );
}

function Toolbar({ filters, riskFilter, onRiskChange, onChange }: { filters: TransactionFilters; riskFilter: "all" | "low" | "medium" | "high"; onRiskChange: (value: "all" | "low" | "medium" | "high") => void; onChange: (filters: TransactionFilters) => void }) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 glass rounded-lg px-3 py-2 flex-1 min-w-[240px]">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={filters.search ?? ""} onChange={(e) => onChange({ ...filters, search: e.target.value })} placeholder="Search merchant, user, country..." className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="flex items-center gap-1">
        {["all", "pending", "safe", "review", "fraud"].map((status) => (
          <button key={status} onClick={() => onChange({ ...filters, status: status as TransactionFilters["status"] })}
            className={`text-xs px-3 py-1.5 rounded-lg capitalize ${filters.status === status ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}>
            {status}
          </button>
        ))}
      </div>
      <input type="date" value={filters.fromDate ?? ""} onChange={(e) => onChange({ ...filters, fromDate: e.target.value || undefined })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <input type="date" value={filters.toDate ?? ""} onChange={(e) => onChange({ ...filters, toDate: e.target.value || undefined })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <select value={riskFilter} onChange={(event) => onRiskChange(event.target.value as "all" | "low" | "medium" | "high")} className="glass rounded-lg px-3 py-2 text-xs bg-background outline-none">
        <option value="all">All risk</option>
        <option value="low">Low risk</option>
        <option value="medium">Medium risk</option>
        <option value="high">High risk</option>
      </select>
    </div>
  );
}

function AdminTransactionModal({ transaction, updating, predicting, onClose, onStatusChange, onPredict }: { transaction: Transaction; updating: boolean; predicting: boolean; onClose: () => void; onStatusChange: (status: TransactionStatus) => void; onPredict: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="glass-strong rounded-2xl max-w-lg w-full p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Transaction TX-{transaction.id}</p>
            <p className="font-display font-semibold text-lg">{transaction.merchant}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Metric label="User" value={transaction.userName ?? `User ${transaction.userId}`} />
          <Metric label="Status" value={<StatusBadge s={transaction.status} />} />
          <Metric label="Category" value={transaction.category} />
          <Metric label="Country" value={transaction.country} />
          <Metric label="Amount" value={formatCurrency(transaction.amount, transaction.currency)} />
          <Metric label="Risk" value={transaction.riskScore == null ? "Pending" : `${transaction.riskScore}/100`} />
          <Metric label="Type" value={transaction.transactionType} />
          <Metric label="Created" value={formatDateTime(transaction.createdAt)} />
        </div>
        {transaction.description && <div className="mt-4 glass rounded-lg p-3 text-sm text-muted-foreground">{transaction.description}</div>}
        <div className="mt-4 glass rounded-lg p-3">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Analysis Result
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
            <Metric label="Status" value={<StatusBadge s={transaction.status} />} />
            <Metric label="Confidence" value={transaction.latestPredictionConfidence == null ? "Pending" : `${Math.round(transaction.latestPredictionConfidence * 100)}%`} />
          </div>
          {transaction.latestPredictionExplanation && transaction.latestPredictionExplanation.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {transaction.latestPredictionExplanation.map((reason) => <li key={reason}>- {formatExplanationFactor(reason)}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No prediction has been run for this transaction yet.</p>
          )}
        </div>
        <div className="mt-6">
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Update status</p>
          <div className="flex flex-wrap gap-2">
            {(["safe", "review", "fraud"] as TransactionStatus[]).map((status) => (
              <button
                key={status}
                disabled={updating}
                onClick={() => onStatusChange(status)}
                className={`rounded-lg px-4 py-2 text-sm capitalize disabled:opacity-60 ${transaction.status === status ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button onClick={onPredict} disabled={predicting} className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-60">
            {predicting ? "Scoring..." : transaction.latestPredictionId ? "Re-analyze" : "Run Analysis"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="glass rounded-lg p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium mt-0.5">{value}</p></div>;
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

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value ?? 0);
}

function formatExplanationFactor(reason: string) {
  const delimiter = reason.indexOf("|");
  return delimiter === -1 ? reason : reason.slice(delimiter + 1).trim();
}

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString() : "";
}
