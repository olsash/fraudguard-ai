import { StatCard } from "@/components/common/StatCard";
import { Topbar } from "@/components/layout/Topbar";
import { adminTransactionService } from "@/services/adminTransactionService";
import type { AdminFilters, AdminPagedResult, AdminTransaction, AdminTransactionDetail } from "@/types/admin";
import type { TransactionStatus } from "@/types/transaction";
import { AlertTriangle, ChevronRight, Gauge, Loader2, Receipt, Search, ShieldCheck, ShieldQuestion, Sparkles, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RiskBar, StatusBadge, Td, Th } from "@/pages/transactions/TransactionsPage";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/formatters";

const transactionTypes = ["all", "CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"] as const;
const emptyFilters: AdminFilters = { status: "all", riskLevel: "all", transactionType: "all", fraudStatus: "all", sortBy: "date", sortDirection: "desc", page: 1, pageSize: 25 };
const emptyPage: AdminPagedResult<AdminTransaction> = { items: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0 };

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [pageData, setPageData] = useState<AdminPagedResult<AdminTransaction>>(emptyPage);
  const [filters, setFilters] = useState<AdminFilters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminTransactionDetail | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);

  const summary = useMemo(() => buildSummary(transactions), [transactions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadTransactions(), 250);
    return () => window.clearTimeout(timeout);
  }, [filters.search, filters.status, filters.riskLevel, filters.transactionType, filters.fraudStatus, filters.minAmount, filters.maxAmount, filters.sortBy, filters.sortDirection, filters.page, filters.pageSize, filters.fromDate, filters.toDate]);

  async function loadTransactions() {
    setLoading(true);
    setError(null);

    try {
      const result = await adminTransactionService.getTransactions(filters);
      setTransactions(result.items);
      setPageData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load admin transactions.");
    } finally {
      setLoading(false);
    }
  }

  function updateFilters(nextFilters: AdminFilters) {
    setFilters({ ...nextFilters, page: 1 });
  }

  function setPage(page: number) {
    setFilters((current) => ({ ...current, page }));
  }

  async function openDetails(id: number) {
    setDetailsLoading(true);
    try {
      setSelected(await adminTransactionService.getTransactionById(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load transaction details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function analyzeTransaction(id: number) {
    setAnalyzingId(id);
    setError(null);

    try {
      const result = await adminTransactionService.analyzeTransaction(id);
      setTransactions((current) => current.map((item) => item.id === id ? result.transaction : item));
      setPageData((current) => ({ ...current, items: current.items.map((item) => item.id === id ? result.transaction : item) }));
      setSelected((current) => current?.id === id ? result.transaction : current);
      toast.success(result.alertCreated ? "Analysis complete. Fraud alert created." : "Analysis complete.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to run analysis.");
    } finally {
      setAnalyzingId(null);
    }
  }

  return (
    <>
      <Topbar title="Transactions" subtitle="All transactions across the platform" />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 space-y-4">
        <section className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
          <StatCard label="Total Transactions" value={pageData.totalCount.toLocaleString()} icon={Receipt} />
          <StatCard label="Pending" value={summary.pending.toLocaleString()} icon={Loader2} tone="primary" />
          <StatCard label="Safe" value={summary.safe.toLocaleString()} icon={ShieldCheck} tone="success" />
          <StatCard label="Review" value={summary.review.toLocaleString()} icon={ShieldQuestion} tone="warning" />
          <StatCard label="Fraud" value={summary.fraud.toLocaleString()} icon={AlertTriangle} tone="destructive" />
          <StatCard label="Total Amount" value={formatCurrency(summary.totalAmount)} icon={Wallet} tone="violet" valueSize="compact" />
          <StatCard label="Average Risk" value={`${summary.averageRisk}/100`} icon={Gauge} tone="primary" valueSize="compact" />
        </section>

        <Toolbar filters={filters} onChange={updateFilters} />

        {loading && <StatePanel title="Loading transactions" message="Fetching platform transactions from FraudGuard API." />}
        {!loading && error && <StatePanel title="Transactions unavailable" message={error} destructive />}
        {!loading && !error && (
          <div className="glass max-w-full rounded-2xl overflow-hidden">
            <div className="scrollbar-thin max-w-full overflow-x-auto">
              <table className="w-full text-sm min-w-[1240px]">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><Th>ID</Th><Th>Prediction</Th><Th>Merchant</Th><Th>User</Th><Th>Type</Th><Th>Country</Th><Th>Amount</Th><Th>Risk</Th><Th>Score</Th><Th>Status</Th><Th>Date</Th><Th>Actions</Th></tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr className="border-t border-border">
                      <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">No transactions found</td>
                    </tr>
                  ) : transactions.map((transaction) => (
                    <tr key={transaction.id} onClick={() => void openDetails(transaction.id)} className="border-t border-border hover:bg-secondary/40 cursor-pointer">
                      <Td><span className="font-mono text-xs">TX-{transaction.id}</span></Td>
                      <Td><span className="font-mono text-xs">{transaction.predictionId ? `PR-${transaction.predictionId}` : "Not analyzed"}</span></Td>
                      <Td>{transaction.merchant}</Td>
                      <Td>{transaction.userName}</Td>
                      <Td><span className="font-mono text-xs">{transaction.transactionType}</span></Td>
                      <Td>{transaction.country}</Td>
                      <Td className="font-mono font-semibold">{formatCurrency(transaction.amount, transaction.currency)}</Td>
                      <Td><RiskBar value={transaction.riskScore} /></Td>
                      <Td className="font-mono">{transaction.riskScore == null ? "-" : `${transaction.riskScore}/100`}</Td>
                      <Td><StatusBadge s={transaction.status} /></Td>
                      <Td className="text-xs text-muted-foreground">{formatDateTime(transaction.createdAt)}</Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void analyzeTransaction(transaction.id);
                            }}
                            disabled={analyzingId === transaction.id}
                            className="rounded px-2 py-1 text-xs glass hover:ring-1 hover:ring-primary/40 disabled:opacity-60"
                          >
                            {analyzingId === transaction.id ? "Scoring..." : transaction.predictionId ? "Re-analyze" : "Run Analysis"}
                          </button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination pageData={pageData} onPageChange={setPage} />
          </div>
        )}
      </main>
      {detailsLoading && !selected && <DetailsLoading />}
      {selected && (
        <AdminTransactionModal
          transaction={selected}
          analyzing={analyzingId === selected.id}
          onClose={() => setSelected(null)}
          onAnalyze={() => void analyzeTransaction(selected.id)}
        />
      )}
    </>
  );
}

function Toolbar({ filters, onChange }: { filters: AdminFilters; onChange: (filters: AdminFilters) => void }) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 glass rounded-lg px-3 py-2 flex-1 min-w-[240px]">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={filters.search ?? ""} onChange={(e) => onChange({ ...filters, search: e.target.value })} placeholder="Search merchant, user, country, transaction ID..." className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="flex items-center gap-1">
        {(["all", "pending", "safe", "review", "fraud"] as Array<"all" | TransactionStatus>).map((status) => (
          <button key={status} onClick={() => onChange({ ...filters, status })}
            className={`text-xs px-3 py-1.5 rounded-lg capitalize ${filters.status === status ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}>
            {status}
          </button>
        ))}
      </div>
      <select value={filters.transactionType ?? "all"} onChange={(event) => onChange({ ...filters, transactionType: event.target.value as AdminFilters["transactionType"] })} className="fg-select glass rounded-lg px-3 py-2 text-xs outline-none">
        {transactionTypes.map((type) => (
          <option key={type} value={type}>{type === "all" ? "All types" : type}</option>
        ))}
      </select>
      <select value={filters.fraudStatus ?? "all"} onChange={(event) => onChange({ ...filters, fraudStatus: event.target.value as AdminFilters["fraudStatus"] })} className="fg-select glass rounded-lg px-3 py-2 text-xs outline-none">
        <option value="all">All fraud status</option>
        <option value="fraud">Fraud only</option>
        <option value="not_fraud">Not fraud</option>
      </select>
      <input type="number" min="0" step="0.01" value={filters.minAmount ?? ""} onChange={(e) => onChange({ ...filters, minAmount: e.target.value || undefined })} placeholder="Min amount" className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none w-28" />
      <input type="number" min="0" step="0.01" value={filters.maxAmount ?? ""} onChange={(e) => onChange({ ...filters, maxAmount: e.target.value || undefined })} placeholder="Max amount" className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none w-28" />
      <input type="date" value={filters.fromDate ?? ""} onChange={(e) => onChange({ ...filters, fromDate: e.target.value || undefined })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <input type="date" value={filters.toDate ?? ""} onChange={(e) => onChange({ ...filters, toDate: e.target.value || undefined })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <select value={filters.riskLevel ?? "all"} onChange={(event) => onChange({ ...filters, riskLevel: event.target.value as AdminFilters["riskLevel"] })} className="fg-select glass rounded-lg px-3 py-2 text-xs outline-none">
        <option value="all">All risk</option>
        <option value="low">Low risk</option>
        <option value="medium">Medium risk</option>
        <option value="high">High risk</option>
      </select>
      <select value={filters.sortBy ?? "date"} onChange={(event) => onChange({ ...filters, sortBy: event.target.value as AdminFilters["sortBy"] })} className="fg-select glass rounded-lg px-3 py-2 text-xs outline-none">
        <option value="date">Sort by date</option>
        <option value="amount">Sort by amount</option>
        <option value="riskScore">Sort by risk</option>
      </select>
      <select value={filters.sortDirection ?? "desc"} onChange={(event) => onChange({ ...filters, sortDirection: event.target.value as AdminFilters["sortDirection"] })} className="fg-select glass rounded-lg px-3 py-2 text-xs outline-none">
        <option value="desc">Descending</option>
        <option value="asc">Ascending</option>
      </select>
      <select value={filters.pageSize ?? 25} onChange={(event) => onChange({ ...filters, pageSize: Number(event.target.value) })} className="fg-select glass rounded-lg px-3 py-2 text-xs outline-none">
        <option value={10}>10 / page</option>
        <option value={25}>25 / page</option>
        <option value={50}>50 / page</option>
        <option value={100}>100 / page</option>
      </select>
    </div>
  );
}

function Pagination({ pageData, onPageChange }: { pageData: AdminPagedResult<AdminTransaction>; onPageChange: (page: number) => void }) {
  const firstItem = pageData.totalCount === 0 ? 0 : (pageData.page - 1) * pageData.pageSize + 1;
  const lastItem = Math.min(pageData.totalCount, pageData.page * pageData.pageSize);
  const canGoBack = pageData.page > 1;
  const canGoForward = pageData.page < pageData.totalPages;

  return (
    <div className="border-t border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>
        Showing {firstItem.toLocaleString()}-{lastItem.toLocaleString()} of {pageData.totalCount.toLocaleString()}
      </span>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(pageData.page - 1)} disabled={!canGoBack} className="glass rounded-lg px-3 py-1.5 disabled:opacity-50">Previous</button>
        <span className="font-mono">Page {pageData.page} / {Math.max(pageData.totalPages, 1)}</span>
        <button onClick={() => onPageChange(pageData.page + 1)} disabled={!canGoForward} className="glass rounded-lg px-3 py-1.5 disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}

function AdminTransactionModal({ transaction, analyzing, onClose, onAnalyze }: { transaction: AdminTransactionDetail; analyzing: boolean; onClose: () => void; onAnalyze: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="glass-strong scrollbar-thin max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Transaction TX-{transaction.id}</p>
            <p className="font-display font-semibold text-lg">{transaction.merchant}</p>
          </div>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <Panel title="Transaction Information">
            <Metric label="Merchant" value={transaction.merchant} />
            <Metric label="Country" value={transaction.country} />
            <Metric label="Category" value={transaction.category} />
            <Metric label="Amount" value={formatCurrency(transaction.amount, transaction.currency)} />
            <Metric label="Currency" value={transaction.currency} />
            <Metric label="Type" value={transaction.transactionType} />
            <Metric label="Created" value={formatDateTime(transaction.createdAt)} />
          </Panel>
          <Panel title="User Information">
            <Metric label="User ID" value={transaction.userId} />
            <Metric label="Name" value={transaction.userName} />
            <Metric label="Email" value={transaction.userEmail ?? "Not available"} />
            <Metric label="Status" value={<StatusBadge s={transaction.status} />} />
          </Panel>
          <Panel title="Prediction Result">
            {transaction.prediction ? (
              <>
                <Metric label="Prediction ID" value={`PR-${transaction.prediction.id}`} />
                <Metric label="Risk Score" value={`${transaction.prediction.riskScore}/100`} />
                <Metric label="Risk Level" value={transaction.prediction.riskLevel} />
                <Metric label="Confidence" value={`${Math.round(transaction.prediction.confidence * 100)}%`} />
                <Metric label="Suggested Action" value={transaction.prediction.suggestedAction} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No prediction has been run for this transaction yet.</p>
            )}
          </Panel>
          <Panel title="Linked Alert">
            {transaction.alert ? (
              <>
                <Metric label="Alert ID" value={`AL-${transaction.alert.id}`} />
                <Metric label="Severity" value={transaction.alert.severity} />
                <Metric label="Status" value={transaction.alert.status} />
                <Metric label="Created" value={formatDateTime(transaction.alert.createdAt)} />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No alert generated for this transaction.</p>
            )}
          </Panel>
        </div>

        <div className="mt-4 glass rounded-lg p-4">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Risk Factors
          </div>
          {transaction.prediction?.factors?.length ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {transaction.prediction.factors.map((reason) => <li key={reason}>- {formatExplanationFactor(reason)}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Run analysis to generate risk factors.</p>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={onAnalyze} disabled={analyzing} className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-60">
            {analyzing ? "Scoring..." : transaction.predictionId ? "Re-analyze" : "Run Analysis"}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildSummary(transactions: AdminTransaction[]) {
  const analyzed = transactions.filter((transaction) => transaction.riskScore != null);
  return {
    total: transactions.length,
    pending: transactions.filter((transaction) => transaction.status === "pending").length,
    safe: transactions.filter((transaction) => transaction.status === "safe").length,
    review: transactions.filter((transaction) => transaction.status === "review").length,
    fraud: transactions.filter((transaction) => transaction.status === "fraud").length,
    totalAmount: transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
    averageRisk: analyzed.length ? Math.round(analyzed.reduce((sum, transaction) => sum + (transaction.riskScore ?? 0), 0) / analyzed.length) : 0,
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
