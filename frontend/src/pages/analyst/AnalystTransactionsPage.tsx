import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { FraudSelect } from "@/components/common/FraudSelect";
import { StatCard } from "@/components/common/StatCard";
import { Topbar } from "@/components/layout/Topbar";
import { RiskBar, Td, Th } from "@/pages/transactions/TransactionsPage";
import { fraudCaseService } from "@/services/fraudCaseService";
import type { AnalystTransaction, AnalystTransactionFilters, AnalystTransactionListResponse } from "@/types/fraudCase";
import { formatCurrency } from "@/utils/formatters";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ChevronRight, Gauge, Loader2, Search, ShieldQuestion, UserCheck, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const emptyResponse: AnalystTransactionListResponse = {
  items: [],
  summary: { totalTransactions: 0, pendingReview: 0, underReview: 0, confirmedFraud: 0, falsePositives: 0, totalAmount: 0, averageRisk: 0 },
  page: 1,
  pageSize: 25,
  totalItems: 0,
  totalPages: 1,
};

const scopes = [
  { value: "reviewRequired", label: "Review Required" },
  { value: "mine", label: "Assigned to Me" },
  { value: "unassigned", label: "Unassigned" },
  { value: "resolved", label: "Resolved by Me" },
];

export default function AnalystTransactionsPage() {
  const [data, setData] = useState<AnalystTransactionListResponse>(emptyResponse);
  const [filters, setFilters] = useState<AnalystTransactionFilters>({ scope: "reviewRequired", page: 1, pageSize: 25, sort: "risk", direction: "desc" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimTarget, setClaimTarget] = useState<AnalystTransaction | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadTransactions(), 250);
    return () => window.clearTimeout(timeout);
  }, [filters.scope, filters.search, filters.processingStatus, filters.caseStatus, filters.analystDecision, filters.transactionType, filters.riskLevel, filters.minRisk, filters.maxRisk, filters.minAmount, filters.maxAmount, filters.from, filters.to, filters.sort, filters.direction, filters.page, filters.pageSize]);

  async function loadTransactions() {
    setLoading(true);
    setError(null);

    try {
      setData(await fraudCaseService.getAnalystTransactions(filters));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load analyst transactions.";
      setError(message.includes("403") ? "Your analyst account can only access transactions linked to review cases." : message);
      if (import.meta.env.DEV) console.error("Analyst transactions request failed", err);
    } finally {
      setLoading(false);
    }
  }

  function updateFilters(next: AnalystTransactionFilters) {
    setFilters({ ...next, page: 1 });
  }

  async function claimCase() {
    if (!claimTarget) return;
    setClaiming(true);
    try {
      await fraudCaseService.claimCase(claimTarget.fraudCaseId);
      toast.success("Case claimed and moved under review.");
      setClaimTarget(null);
      await loadTransactions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to claim case.");
    } finally {
      setClaiming(false);
    }
  }

  const summary = data.summary;

  return (
    <>
      <Topbar title="Transactions" subtitle="Transactions requiring fraud review and cases assigned to you" />
      <main className="min-w-0 flex-1 space-y-4 overflow-x-hidden p-4 md:p-8">
        <div className="flex flex-wrap gap-2">
          {scopes.map((scope) => (
            <button
              key={scope.value}
              onClick={() => updateFilters({ ...filters, scope: scope.value })}
              className={`rounded-lg px-3 py-2 text-xs ${filters.scope === scope.value ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}
            >
              {scope.label}
            </button>
          ))}
        </div>

        {!error && (
          <section className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
            <StatCard label="Review Required" value={summary.pendingReview.toLocaleString()} icon={ShieldQuestion} tone="warning" />
            <StatCard label="Under Review" value={summary.underReview.toLocaleString()} icon={UserCheck} tone="primary" />
            <StatCard label="Confirmed Fraud" value={summary.confirmedFraud.toLocaleString()} icon={AlertTriangle} tone="destructive" />
            <StatCard label="False Positives" value={summary.falsePositives.toLocaleString()} icon={CheckCircle2} tone="success" />
            <StatCard label="Total Reviewed Amount" value={formatCurrency(summary.totalAmount)} icon={Wallet} tone="violet" valueSize="compact" />
            <StatCard label="Average Risk" value={`${Math.round(summary.averageRisk)}/100`} icon={Gauge} tone="primary" valueSize="compact" />
          </section>
        )}

        <Toolbar filters={filters} onChange={updateFilters} />

        {loading && <StatePanel title="Loading transactions" message="Fetching review-related transaction records." />}
        {!loading && error && (
          <StatePanel
            title={error.includes("access") ? "You do not have access to this transaction view." : "Transactions unavailable"}
            message={error.includes("access") ? "Your analyst account can only access transactions linked to review cases." : error}
            destructive
            onRetry={() => void loadTransactions()}
          />
        )}
        {!loading && !error && (
          <section className="glass max-w-full overflow-hidden rounded-2xl">
            <div className="scrollbar-thin max-w-full overflow-x-auto">
              <table className="w-full min-w-[1220px] text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <Th>Transaction</Th><Th>Case</Th><Th>Customer</Th><Th>Counterparty</Th><Th>Type</Th><Th>Amount</Th><Th>Risk</Th><Th>Model</Th><Th>Transaction Status</Th><Th>Case Status</Th><Th>Assigned</Th><Th>Date</Th><Th>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.length === 0 ? (
                    <tr className="border-t border-border">
                      <td colSpan={13} className="px-4 py-10 text-center text-sm text-muted-foreground">No review-related transactions match this scope.</td>
                    </tr>
                  ) : data.items.map((item) => (
                    <tr key={item.fraudCaseId} className="border-t border-border hover:bg-secondary/40">
                      <Td><CaseLink item={item} label={item.transactionReference} /></Td>
                      <Td><CaseLink item={item} label={item.caseReference} /></Td>
                      <Td>{item.customerName}</Td>
                      <Td>{item.merchantName ?? item.beneficiaryName ?? "-"}</Td>
                      <Td><span className="font-mono text-xs">{item.transactionType}</span></Td>
                      <Td className="font-mono font-semibold">{formatCurrency(item.amount, item.currency)}</Td>
                      <Td><RiskBar value={item.modelRiskScore} /></Td>
                      <Td>{item.modelDecision}</Td>
                      <Td>{formatStatus(item.processingStatus)}</Td>
                      <Td><StatusBadge status={item.caseStatus} /></Td>
                      <Td>{item.assignedAnalystName ?? "Unassigned"}</Td>
                      <Td className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</Td>
                      <Td><RowActions item={item} onClaim={() => setClaimTarget(item)} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination data={data} onPageChange={(page) => setFilters((current) => ({ ...current, page }))} />
          </section>
        )}
      </main>
      <ConfirmDialog
        open={Boolean(claimTarget)}
        title="Claim Case"
        description={claimTarget ? `Claim ${claimTarget.caseReference} and move it under review.` : ""}
        confirmLabel="Claim Case"
        loading={claiming}
        onOpenChange={(open) => {
          if (!open) setClaimTarget(null);
        }}
        onConfirm={() => void claimCase()}
      />
    </>
  );
}

function Toolbar({ filters, onChange }: { filters: AnalystTransactionFilters; onChange: (filters: AnalystTransactionFilters) => void }) {
  return (
    <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
      <div className="glass flex min-w-[240px] flex-1 items-center gap-2 rounded-lg px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={filters.search ?? ""} onChange={(e) => onChange({ ...filters, search: e.target.value })} placeholder="Search case, transaction, customer..." className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      <FraudSelect value={filters.transactionType ?? "all"} onValueChange={(value) => onChange({ ...filters, transactionType: value })} options={["all", "PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT"].map((value) => ({ value, label: value === "all" ? "All types" : value }))} ariaLabel="Transaction type" triggerClassName="h-9 min-h-9 w-[140px] px-3 py-2 text-xs" />
      <FraudSelect value={filters.riskLevel ?? "all"} onValueChange={(value) => onChange({ ...filters, riskLevel: value })} options={[{ value: "all", label: "All risk" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} ariaLabel="Risk" triggerClassName="h-9 min-h-9 w-[120px] px-3 py-2 text-xs" />
      <FraudSelect value={filters.caseStatus ?? "all"} onValueChange={(value) => onChange({ ...filters, caseStatus: value })} options={[{ value: "all", label: "All cases" }, { value: "Open", label: "Open" }, { value: "UnderReview", label: "Under Review" }, { value: "Resolved", label: "Resolved" }]} ariaLabel="Case status" triggerClassName="h-9 min-h-9 w-[140px] px-3 py-2 text-xs" />
      <input type="number" min="0" value={filters.minAmount ?? ""} onChange={(e) => onChange({ ...filters, minAmount: e.target.value || undefined })} placeholder="Min amount" className="glass w-28 rounded-lg bg-transparent px-3 py-2 text-xs outline-none" />
      <input type="number" min="0" value={filters.maxAmount ?? ""} onChange={(e) => onChange({ ...filters, maxAmount: e.target.value || undefined })} placeholder="Max amount" className="glass w-28 rounded-lg bg-transparent px-3 py-2 text-xs outline-none" />
    </div>
  );
}

function RowActions({ item, onClaim }: { item: AnalystTransaction; onClaim: () => void }) {
  if (item.canClaim) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={onClaim} className="glass rounded px-2 py-1 text-xs hover:ring-1 hover:ring-primary/40">Claim Case</button>
        <CaseLink item={item} label="View Read-Only" readOnly />
      </div>
    );
  }

  return (
    <CaseLink item={item} label={item.caseStatus === "Resolved" ? "View Decision" : item.canReview ? "Continue Investigation" : "View Read-Only"} readOnly={!item.canReview || item.caseStatus === "Resolved"} />
  );
}

function CaseLink({ item, label, readOnly }: { item: AnalystTransaction; label: string; readOnly?: boolean }) {
  return (
    <Link to="/analyst/investigations/$caseId" params={{ caseId: String(item.fraudCaseId) }} search={readOnly ? { mode: "readonly" } : undefined} className="inline-flex items-center gap-1 text-primary hover:underline">
      {label}
      <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function Pagination({ data, onPageChange }: { data: AnalystTransactionListResponse; onPageChange: (page: number) => void }) {
  const canBack = data.page > 1;
  const canForward = data.page < data.totalPages;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
      <span>{data.totalItems.toLocaleString()} review-related transaction(s)</span>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(data.page - 1)} disabled={!canBack} className="glass rounded-lg px-3 py-1.5 disabled:opacity-50">Previous</button>
        <span className="font-mono">Page {data.page} / {data.totalPages}</span>
        <button onClick={() => onPageChange(data.page + 1)} disabled={!canForward} className="glass rounded-lg px-3 py-1.5 disabled:opacity-50">Next</button>
      </div>
    </div>
  );
}

function StatePanel({ title, message, destructive, onRetry }: { title: string; message: string; destructive?: boolean; onRetry?: () => void }) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      {!destructive && <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}
      <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {onRetry && <button onClick={onRetry} className="glass mt-4 rounded-lg px-4 py-2 text-sm">Retry</button>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "Resolved" ? "bg-success/15 text-success" : status === "UnderReview" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning";
  return <span className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wider ${tone}`}>{formatStatus(status)}</span>;
}

function formatStatus(value: string) {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatDateTime(value: string) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "-";
}
