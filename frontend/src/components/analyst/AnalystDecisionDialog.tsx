import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/common/ui/dialog";
import { Button } from "@/components/common/ui/button";
import { Textarea } from "@/components/common/ui/textarea";
import type { FraudCase } from "@/types/fraudCase";
import { formatCurrency } from "@/utils/formatters";
import { CheckCircle2, Loader2, ShieldAlert, UserCheck, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type AnalystDecisionType = "claim" | "approve" | "false-positive" | "confirm-fraud" | "reject";

interface AnalystDecisionDialogProps {
  caseItem: FraudCase | null;
  decision: AnalystDecisionType | null;
  initialComment?: string;
  loading?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (comment: string) => Promise<void>;
}

const decisionCopy: Record<AnalystDecisionType, {
  title: string;
  description: string;
  helper: string;
  confirmLabel: string;
  loadingLabel: string;
  badgeClassName: string;
  buttonClassName: string;
  requiresComment: boolean;
  Icon: typeof CheckCircle2;
}> = {
  claim: {
    title: "Claim Case",
    description: "Assign this case to yourself and start the review immediately.",
    helper: "The case will move directly to Under Review.",
    confirmLabel: "Claim Case",
    loadingLabel: "Claiming...",
    badgeClassName: "bg-primary/15 text-primary",
    buttonClassName: "bg-primary text-primary-foreground hover:bg-primary/90",
    requiresComment: false,
    Icon: UserCheck,
  },
  approve: {
    title: "Approve Transaction",
    description: "Approve this transaction and complete it after revalidating balances.",
    helper: "The system will revalidate balances before completing the transaction.",
    confirmLabel: "Approve Transaction",
    loadingLabel: "Approving...",
    badgeClassName: "bg-success/15 text-success",
    buttonClassName: "bg-success text-white hover:bg-success/90",
    requiresComment: false,
    Icon: CheckCircle2,
  },
  "false-positive": {
    title: "Mark as False Positive",
    description: "The model flagged this transaction as suspicious, but you are marking it as legitimate.",
    helper: "The original ML prediction will remain stored separately from your analyst decision.",
    confirmLabel: "Mark False Positive",
    loadingLabel: "Submitting...",
    badgeClassName: "bg-primary/15 text-primary",
    buttonClassName: "bg-primary text-primary-foreground hover:bg-primary/90",
    requiresComment: true,
    Icon: CheckCircle2,
  },
  "confirm-fraud": {
    title: "Confirm Fraud",
    description: "This will reject the transaction and mark the case as confirmed fraud.",
    helper: "No balance changes will be applied to this transaction.",
    confirmLabel: "Confirm Fraud",
    loadingLabel: "Confirming...",
    badgeClassName: "bg-destructive/15 text-destructive",
    buttonClassName: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    requiresComment: true,
    Icon: ShieldAlert,
  },
  reject: {
    title: "Reject Transaction",
    description: "Reject this transaction and close the investigation accordingly.",
    helper: "The transaction will be rejected without applying balance changes.",
    confirmLabel: "Reject Transaction",
    loadingLabel: "Rejecting...",
    badgeClassName: "bg-destructive/15 text-destructive",
    buttonClassName: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    requiresComment: true,
    Icon: XCircle,
  },
};

export function AnalystDecisionDialog({
  caseItem,
  decision,
  initialComment = "",
  loading = false,
  onOpenChange,
  onConfirm,
}: AnalystDecisionDialogProps) {
  const open = Boolean(caseItem && decision);
  const config = decision ? decisionCopy[decision] : null;
  const [comment, setComment] = useState(initialComment);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setComment(initialComment);
      setError(null);
    }
  }, [initialComment, open]);

  if (!caseItem || !config) {
    return null;
  }

  const Icon = config.Icon;

  async function handleConfirm() {
    const trimmedComment = comment.trim();
    if (config.requiresComment && !trimmedComment) {
      setError("Enter an analyst comment before confirming this decision.");
      requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    setError(null);
    await onConfirm(trimmedComment);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !loading && onOpenChange(nextOpen)}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-xl flex-col overflow-hidden rounded-2xl border-border bg-background/95 p-0 text-foreground shadow-2xl backdrop-blur">
        <DialogHeader className="shrink-0 border-b border-border px-5 pb-4 pt-5 text-left">
          <div className="flex items-start gap-3">
            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${config.badgeClassName}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="font-display text-xl">{config.title}</DialogTitle>
              <DialogDescription className="mt-2 leading-6">{config.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className={`rounded-md px-2 py-1 text-xs font-medium ${config.badgeClassName}`}>
                {config.title}
              </span>
              <span className="text-xs text-muted-foreground">Risk {caseItem.modelRiskScore}/100</span>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <SummaryItem label="Case" value={caseItem.caseReference} />
              <SummaryItem label="Transaction" value={caseItem.transactionReference} />
              <SummaryItem label="Customer" value={caseItem.customerName} />
              <SummaryItem label="Amount" value={formatCurrency(caseItem.amount, caseItem.currency)} />
            </dl>
          </div>

          <p className="text-sm text-muted-foreground">{config.helper}</p>

          {decision !== "claim" && (
            <label className="block">
              <span className="text-sm font-medium">
                Analyst comment {config.requiresComment ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(optional)</span>}
              </span>
              <Textarea
                ref={textareaRef}
                value={comment}
                onChange={(event) => {
                  setComment(event.target.value);
                  if (error) setError(null);
                }}
                className="mt-2 min-h-28 resize-y bg-background/70"
                placeholder="Add a concise decision note for the investigation record."
                disabled={loading}
                aria-invalid={Boolean(error)}
              />
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            </label>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background/95 px-5 py-4 sm:space-x-2">
          <Button type="button" variant="outline" disabled={loading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={loading} onClick={() => void handleConfirm()} className={config.buttonClassName}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? config.loadingLabel : config.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words font-medium">{value}</dd>
    </div>
  );
}
