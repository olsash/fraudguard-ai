import { AnalystDecisionDialog, type AnalystDecisionType } from "@/components/analyst/AnalystDecisionDialog";
import { Topbar } from "@/components/layout/Topbar";
import { ApiError } from "@/services/api";
import { fraudCaseService } from "@/services/fraudCaseService";
import type { FraudCase } from "@/types/fraudCase";
import { formatCurrency } from "@/utils/formatters";
import { useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, ShieldAlert, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function InvestigationDetailPage({ caseId, readOnlyRequested = false }: { caseId: number; readOnlyRequested?: boolean }) {
  const navigate = useNavigate();
  const [item, setItem] = useState<FraudCase | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<AnalystDecisionType | "comment" | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<AnalystDecisionType | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(caseId) || caseId <= 0) {
      setLoading(false);
      setError("Investigation case not found.");
      return;
    }

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
      if (err instanceof ApiError && err.status === 404) {
        setError("Investigation case not found.");
      } else if (err instanceof ApiError && err.status === 403) {
        setError("You are not authorized to view this investigation case.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to load investigation.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function addNote() {
    if (!item) return;
    setProcessing("comment");
    try {
      const updated = await fraudCaseService.addComment(item.id, comment);
      setItem(updated);
      setComment(updated.analystComment ?? "");
      toast.success("Investigation note added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to add note.");
    } finally {
      setProcessing(null);
    }
  }

  async function confirmDecision(decisionComment: string) {
    if (!item || !selectedDecision) return;

    setProcessing(selectedDecision);
    try {
      const updated = await runDecisionAction(item.id, selectedDecision, decisionComment);
      setItem(updated);
      setComment(updated.analystComment ?? "");
      setSelectedDecision(null);
      toast.success(successMessageFor(selectedDecision));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update case.");
    } finally {
      setProcessing(null);
    }
  }

  const readOnlyMode = readOnlyRequested || !item?.canReview || item.status === "Resolved";

  return (
    <>
      <Topbar title={item ? `Investigation FC-${item.id}` : "Investigation"} subtitle="Fraud case details and analyst decision controls" />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 space-y-4">
        {loading && <StatePanel title="Loading investigation" message="Fetching case evidence." />}
        {!loading && error && <StatePanel title="Investigation unavailable" message={error} destructive />}
        {!loading && item && (
          <>
            {readOnlyMode && (
              <div className="glass rounded-2xl border border-primary/25 p-4 text-sm text-muted-foreground">
                This case is available in read-only mode.
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button onClick={() => navigate({ to: "/analyst/review-queue" })} className="glass rounded-lg px-3 py-2 text-sm">Back to queue</button>
              <div className="flex flex-wrap gap-2">
                {item.canClaim && <button disabled={!!processing} onClick={() => setSelectedDecision("claim")} className="glass rounded-lg px-3 py-2 text-sm disabled:opacity-50">Claim Case</button>}
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.caseReference} / {item.transactionReference}</p>
                    <h2 className="mt-1 font-display text-xl font-semibold">{item.merchant}</h2>
                  </div>
                  <Badge value={item.status} />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Metric label="Customer" value={`${item.customerName} (${item.customerEmail})`} />
                  <Metric label="Customer status" value={item.customerIsActive ? "Active" : "Inactive"} />
                  <Metric label="Amount" value={formatCurrency(item.amount, item.currency)} />
                  <Metric label="Transaction type" value={item.transactionType} />
                  <Metric label="Processing status" value={item.processingStatus} />
                  <Metric label="Source bank" value={item.sourceBank ?? "Unavailable"} />
                  <Metric label="Source account" value={item.sourceAccount ?? "Masked account unavailable"} />
                  <Metric label="Source IBAN" value={item.sourceIban ?? "Masked IBAN unavailable"} />
                  <Metric label="Destination bank" value={item.destinationBank ?? "Not applicable"} />
                  <Metric label="Destination account" value={item.destinationAccount ?? item.beneficiaryName ?? "Not applicable"} />
                  <Metric label="Assigned analyst" value={item.assignedAnalystName ?? "Unassigned"} />
                </div>
              </section>

              <section className="glass rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Model Assessment</p>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="font-display text-3xl font-semibold">{item.modelRiskScore}/100</p>
                    <p className="text-sm text-muted-foreground">{item.modelName ?? "ML model"} / {item.modelVersion ?? "exported model"}</p>
                    <p className="text-sm text-muted-foreground">Predicted class: {item.predictedClass ?? item.modelDecision}</p>
                    <p className="text-sm text-muted-foreground">Model decision: {item.modelDecision}</p>
                    <p className="text-sm text-muted-foreground">
                      Predicted at: {item.predictionCreatedAt ? new Date(item.predictionCreatedAt).toLocaleString() : "Unavailable"}
                    </p>
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
                <p className="font-display font-semibold">Analyst Review</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Metric label="Assigned analyst" value={item.assignedAnalystName ?? "Unassigned"} />
                  <Metric label="Review status" value={item.status} />
                  <Metric label="Analyst decision" value={item.analystDecision ?? item.finalDecision ?? "Not decided"} />
                  <Metric label="Review started" value={item.reviewStartedAt ? new Date(item.reviewStartedAt).toLocaleString() : "Not started"} />
                  <Metric label="Reviewed" value={item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : "Not reviewed"} />
                  <Metric label="Resolved" value={item.resolvedAt ? new Date(item.resolvedAt).toLocaleString() : "Unresolved"} />
                </div>
                {item.analystComment && <p className="mt-3 text-sm text-muted-foreground">{item.analystComment}</p>}
              </section>
              {item.transactionType === "PAYMENT" && (
                <section className="glass rounded-2xl p-5">
                  <p className="font-display font-semibold">Merchant Context</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <Metric label="Merchant code" value={item.merchantCode ?? "Unavailable"} />
                    <Metric label="Category" value={item.merchantCategory ?? "Unavailable"} />
                    <Metric label="Country" value={item.merchantCountry ?? "Unavailable"} />
                    <Metric label="Settlement bank" value={item.merchantBankName ?? "Unavailable"} />
                    <Metric label="Settlement account" value={item.maskedMerchantSettlementAccount ?? "Unavailable"} />
                    <Metric label="Merchant risk" value={item.merchantRiskLevel ?? "Unavailable"} />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Merchant risk is business context only. The saved ML model result remains separate from analyst decisions.
                  </p>
                </section>
              )}
              <section className="glass rounded-2xl p-5">
                <p className="font-display font-semibold">Balance Evidence</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Metric label="Old origin balance" value={formatOptionalMoney(item.oldBalanceOrigin, item.currency)} />
                  <Metric label="Proposed new origin" value={formatOptionalMoney(item.newBalanceOrigin, item.currency)} />
                  <Metric label="Old destination balance" value={formatOptionalMoney(item.oldBalanceDestination, item.currency)} />
                  <Metric label="Proposed new destination" value={formatOptionalMoney(item.newBalanceDestination, item.currency)} />
                </div>
              </section>
              <section className="glass rounded-2xl p-5">
                <p className="font-display font-semibold">Alert Information</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Metric label="Severity" value={item.alertSeverity ?? "Unavailable"} />
                  <Metric label="Status" value={item.alertStatus ?? "Unavailable"} />
                  <Metric label="Created" value={item.alertCreatedAt ? new Date(item.alertCreatedAt).toLocaleString() : "Unavailable"} />
                  <Metric label="Prediction date" value={item.predictionCreatedAt ? new Date(item.predictionCreatedAt).toLocaleString() : "Unavailable"} />
                </div>
              </section>
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
                  {item.reviewStartedAt && <p>Review started: {new Date(item.reviewStartedAt).toLocaleString()}</p>}
                  {item.reviewedAt && <p>Reviewed: {new Date(item.reviewedAt).toLocaleString()}</p>}
                  {item.resolvedAt && <p>Resolved: {new Date(item.resolvedAt).toLocaleString()}</p>}
                  {item.notes.map((note) => <p key={note.id}>Note by {note.analystName}: {note.comment} ({new Date(note.createdAt).toLocaleString()})</p>)}
                  {item.relatedAlerts.map((alert) => <p key={alert}>{alert}</p>)}
                </div>
              </section>
            </div>

            <section className="glass rounded-2xl p-5">
              <label className="block">
                <span className="text-sm font-medium">Analyst notes</span>
                <textarea value={comment} onChange={(event) => setComment(event.target.value)} readOnly={readOnlyMode} className="mt-2 min-h-28 w-full glass rounded-lg bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/60 disabled:opacity-60" />
              </label>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {!readOnlyMode && (
                  <>
                    <button disabled={!!processing || !item.canReview || item.status === "Resolved"} onClick={() => void addNote()} className="glass rounded-lg px-4 py-2 text-sm disabled:opacity-50">
                      {processing === "comment" ? "Adding..." : "Add Note"}
                    </button>
                    <button disabled={!!processing || !item.canReview || item.status === "Resolved"} onClick={() => setSelectedDecision("approve")} className="rounded-lg bg-success px-4 py-2 text-sm text-white disabled:opacity-50"><CheckCircle2 className="mr-2 inline h-4 w-4" />Approve</button>
                    <button disabled={!!processing || !item.canReview || item.status === "Resolved"} onClick={() => setSelectedDecision("false-positive")} className="glass rounded-lg px-4 py-2 text-sm disabled:opacity-50">False Positive</button>
                    <button disabled={!!processing || !item.canReview || item.status === "Resolved"} onClick={() => setSelectedDecision("confirm-fraud")} className="rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-50"><ShieldAlert className="mr-2 inline h-4 w-4" />Confirm Fraud</button>
                    <button disabled={!!processing || !item.canReview || item.status === "Resolved"} onClick={() => setSelectedDecision("reject")} className="glass rounded-lg px-4 py-2 text-sm disabled:opacity-50"><XCircle className="mr-2 inline h-4 w-4" />Reject</button>
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      <AnalystDecisionDialog
        caseItem={item}
        decision={selectedDecision}
        initialComment={comment}
        loading={Boolean(selectedDecision && processing === selectedDecision)}
        onOpenChange={(open) => {
          if (!open) setSelectedDecision(null);
        }}
        onConfirm={confirmDecision}
      />
    </>
  );
}

function runDecisionAction(caseId: number, decision: AnalystDecisionType, comment: string) {
  switch (decision) {
    case "claim":
      return fraudCaseService.claim(caseId);
    case "approve":
      return fraudCaseService.approve(caseId, comment);
    case "false-positive":
      return fraudCaseService.falsePositive(caseId, comment);
    case "confirm-fraud":
      return fraudCaseService.confirmFraud(caseId, comment);
    case "reject":
      return fraudCaseService.reject(caseId, comment);
  }
}

function successMessageFor(decision: AnalystDecisionType) {
  switch (decision) {
    case "claim":
      return "Case claimed and review started.";
    case "approve":
      return "Transaction approved successfully.";
    case "false-positive":
      return "Case marked as false positive.";
    case "confirm-fraud":
      return "Fraud confirmed and transaction rejected.";
    case "reject":
      return "Transaction rejected successfully.";
  }
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

function formatOptionalMoney(value: number | null | undefined, currency: string) {
  return typeof value === "number" ? formatCurrency(value, currency) : "Unavailable";
}
