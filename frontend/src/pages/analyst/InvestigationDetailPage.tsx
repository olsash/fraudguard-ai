import { Topbar } from "@/components/layout/Topbar";
import { fraudCaseService } from "@/services/fraudCaseService";
import type { FraudCase } from "@/types/fraudCase";
import { formatCurrency } from "@/utils/formatters";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function InvestigationDetailPage({ caseId }: { caseId: number }) {
  const navigate = useNavigate();
  const [item, setItem] = useState<FraudCase | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, [caseId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const row = await fraudCaseService.getCase(caseId);
      setItem(row);
      setComment(row.analystComment ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load investigation.");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(label: string, action: () => Promise<FraudCase>, confirmation?: string) {
    if (confirmation && !window.confirm(confirmation)) return;
    setProcessing(label);
    try {
      const updated = await action();
      setItem(updated);
      setComment(updated.analystComment ?? "");
      toast.success(`Case FC-${updated.id} updated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update case.");
    } finally {
      setProcessing(null);
    }
  }

  return (
    <>
      <Topbar title={item ? `Investigation FC-${item.id}` : "Investigation"} subtitle="Fraud case details and analyst decision controls" />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 space-y-4">
        {loading && <StatePanel title="Loading investigation" message="Fetching case evidence." />}
        {!loading && error && <StatePanel title="Investigation unavailable" message={error} destructive />}
        {!loading && item && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => navigate({ to: "/analyst/review-queue" })} className="glass rounded-lg px-3 py-2 text-sm">Back to queue</button>
              <div className="flex flex-wrap gap-2">
                <button disabled={!!processing || item.status === "Resolved"} onClick={() => void runAction("claim", () => fraudCaseService.claim(item.id))} className="glass rounded-lg px-3 py-2 text-sm disabled:opacity-50">Claim</button>
                <button disabled={!!processing || item.status === "Resolved"} onClick={() => void runAction("review", () => fraudCaseService.markUnderReview(item.id))} className="glass rounded-lg px-3 py-2 text-sm disabled:opacity-50">Mark under review</button>
                <button disabled={!!processing || item.status === "Resolved"} onClick={() => void runAction("escalate", () => fraudCaseService.escalate(item.id))} className="glass rounded-lg px-3 py-2 text-sm disabled:opacity-50">Escalate</button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Transaction TX-{item.transactionId}</p>
                    <h2 className="mt-1 font-display text-xl font-semibold">{item.merchant}</h2>
                  </div>
                  <Badge value={item.status} />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Metric label="Customer" value={`${item.customerName} (${item.customerEmail})`} />
                  <Metric label="Amount" value={formatCurrency(item.amount, item.currency)} />
                  <Metric label="Transaction type" value={item.transactionType} />
                  <Metric label="Source account" value={item.sourceAccount ?? "Masked account unavailable"} />
                  <Metric label="Beneficiary" value={item.beneficiaryName ?? "Not applicable"} />
                  <Metric label="Assigned analyst" value={item.assignedAnalystName ?? "Unassigned"} />
                </div>
              </section>

              <section className="glass rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Model Result</p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="font-display text-3xl font-semibold">{item.modelRiskScore}/100</p>
                    <p className="text-sm text-muted-foreground">{item.modelDecision}</p>
                  </div>
                  <Badge value={item.priority} />
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, item.modelRiskScore))}%` }} />
                </div>
              </section>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <section className="glass rounded-2xl p-5">
                <p className="font-display font-semibold">Risk Factors and Explanation</p>
                {item.modelReasons.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No explanation factors were saved for this case.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                    {item.modelReasons.map((reason) => <li key={reason}>- {formatReason(reason)}</li>)}
                  </ul>
                )}
              </section>
              <section className="glass rounded-2xl p-5">
                <p className="font-display font-semibold">Related Alerts and Timeline</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>Created: {new Date(item.createdAt).toLocaleString()}</p>
                  {item.assignedAt && <p>Assigned: {new Date(item.assignedAt).toLocaleString()}</p>}
                  {item.reviewedAt && <p>Reviewed: {new Date(item.reviewedAt).toLocaleString()}</p>}
                  {item.resolvedAt && <p>Resolved: {new Date(item.resolvedAt).toLocaleString()}</p>}
                  {item.relatedAlerts.map((alert) => <p key={alert}>{alert}</p>)}
                </div>
              </section>
            </div>

            <section className="glass rounded-2xl p-5">
              <label className="block">
                <span className="text-sm font-medium">Analyst notes</span>
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} className="mt-2 min-h-28 w-full glass rounded-lg bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/60" />
              </label>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button disabled={!!processing || item.status === "Resolved"} onClick={() => void runAction("comment", () => fraudCaseService.addComment(item.id, comment))} className="glass rounded-lg px-4 py-2 text-sm disabled:opacity-50">Save notes</button>
                <button disabled={!!processing || item.status === "Resolved"} onClick={() => void runAction("approve", () => fraudCaseService.approve(item.id, comment), "Approve and complete this transaction? Balances will be revalidated first.")} className="rounded-lg bg-success px-4 py-2 text-sm text-white disabled:opacity-50"><CheckCircle2 className="mr-2 inline h-4 w-4" />Approve</button>
                <button disabled={!!processing || item.status === "Resolved"} onClick={() => void runAction("fraud", () => fraudCaseService.confirmFraud(item.id, comment), "Confirm this transaction as fraud and reject it?")} className="rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-50"><ShieldAlert className="mr-2 inline h-4 w-4" />Confirm Fraud</button>
                <button disabled={!!processing || item.status === "Resolved"} onClick={() => void runAction("reject", () => fraudCaseService.reject(item.id, comment), "Reject this transaction without applying balances?")} className="glass rounded-lg px-4 py-2 text-sm disabled:opacity-50"><XCircle className="mr-2 inline h-4 w-4" />Reject</button>
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="glass rounded-lg p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>;
}

function Badge({ value }: { value: string }) {
  return <span className="rounded-md bg-primary/15 px-2 py-1 text-[10px] uppercase tracking-wider text-primary">{value}</span>;
}

function StatePanel({ title, message, destructive }: { title: string; message: string; destructive?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      {!destructive && <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}
      <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function formatReason(reason: string) {
  const delimiter = reason.indexOf("|");
  return delimiter === -1 ? reason : reason.slice(delimiter + 1).trim();
}
