import { alertService } from "@/services/alertService";
import type { AlertSeverity, AlertStatus, FraudAlertRecord } from "@/types/alertApi";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const severityClasses: Record<AlertSeverity, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/40",
  high: "bg-destructive/10 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-primary/15 text-primary border-primary/30",
};

const statusClasses: Record<AlertStatus, string> = {
  open: "bg-destructive/10 text-destructive border-destructive/30",
  investigating: "bg-warning/15 text-warning border-warning/30",
  resolved: "bg-success/15 text-success border-success/30",
};

const statusExplanation: Record<AlertStatus, string> = {
  open: "New alert waiting for admin review.",
  investigating: "Admin is reviewing this alert.",
  resolved: "This alert has been reviewed and closed.",
};

export function AlertsWorkspace({ admin = false }: { admin?: boolean }) {
  const [alerts, setAlerts] = useState<FraudAlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<AlertStatus | "all">("all");
  const [severity, setSeverity] = useState<AlertSeverity | "all">("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FraudAlertRecord | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<FraudAlertRecord | null>(null);

  useEffect(() => {
    void loadAlerts();
  }, []);

  async function loadAlerts() {
    setLoading(true);
    setError(null);
    try {
      setAlerts(await alertService.getAlerts());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load alerts.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(alert: FraudAlertRecord, nextStatus: AlertStatus) {
    if (!admin || nextStatus === alert.status) return;

    setUpdatingId(alert.id);
    try {
      await alertService.updateStatus(alert.id, nextStatus);
      setAlerts(await alertService.getAlerts());
      toast.success(`Alert marked as ${nextStatus}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update alert.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function deleteAlert() {
    if (!deleteTarget) return;

    setUpdatingId(deleteTarget.id);
    try {
      await alertService.deleteAlert(deleteTarget.id);
      setAlerts((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success("Alert deleted successfully.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to delete alert.");
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredAlerts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return alerts.filter((alert) => {
      const matchesSearch = !query
        || alert.title.toLowerCase().includes(query)
        || alert.merchant.toLowerCase().includes(query)
        || alert.country.toLowerCase().includes(query)
        || (alert.userName ?? "").toLowerCase().includes(query);
      return matchesSearch
        && (status === "all" || alert.status === status)
        && (severity === "all" || alert.severity === severity);
    });
  }, [alerts, search, severity, status]);

  const highRiskCount = alerts.filter((alert) => alert.severity === "high" || alert.severity === "critical" || alert.riskScore >= 70).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Total alerts" value={alerts.length} color="text-primary" />
        <Stat label="High risk alerts" value={highRiskCount} color="text-destructive" />
      </div>

      <section className="glass rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border space-y-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-display font-semibold">{admin ? "Security operations queue" : "Your fraud alerts"}</p>
              <p className="text-xs text-muted-foreground">
                {admin ? "Review and manage alerts across all users." : "Alerts generated from your reviewed and fraudulent transactions."}
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-[1fr_180px_180px] gap-3">
            <label className="glass rounded-lg px-3 py-2.5 flex items-center gap-2 focus-within:ring-1 focus-within:ring-primary/50">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search merchant, title, or country"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </label>
            <FilterSelect
              label="Status"
              value={status}
              onChange={(value) => setStatus(value as AlertStatus | "all")}
              options={["all", "open", "investigating", "resolved"]}
            />
            <FilterSelect
              label="Severity"
              value={severity}
              onChange={(value) => setSeverity(value as AlertSeverity | "all")}
              options={["all", "low", "medium", "high", "critical"]}
            />
          </div>
        </div>

        {loading ? (
          <StateMessage icon={Loader2} message="Loading alerts..." spinning />
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button onClick={() => void loadAlerts()} className="mt-4 glass rounded-lg px-4 py-2 text-sm inline-flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <StateMessage icon={CheckCircle2} message={alerts.length === 0 ? "No fraud alerts have been generated yet." : "No alerts match the current filters."} />
        ) : (
          <div className="divide-y divide-border">
            {filteredAlerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                admin={admin}
                updating={updatingId === alert.id}
                onStatus={admin ? (nextStatus) => void updateStatus(alert, nextStatus) : undefined}
                onDelete={() => setDeleteTarget(alert)}
                onOpen={() => setSelectedAlert(alert)}
              />
            ))}
          </div>
        )}
      </section>

      {deleteTarget && (
        <DeleteDialog
          alert={deleteTarget}
          deleting={updatingId === deleteTarget.id}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void deleteAlert()}
        />
      )}
      {selectedAlert && <AlertDetailsModal alert={selectedAlert} onClose={() => setSelectedAlert(null)} />}
    </div>
  );
}

function AlertRow({
  alert,
  admin,
  updating,
  onStatus,
  onDelete,
  onOpen,
}: {
  alert: FraudAlertRecord;
  admin: boolean;
  updating: boolean;
  onStatus?: (status: AlertStatus) => void;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
      className="cursor-pointer p-5 hover:bg-secondary/20 transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary/40"
    >
      <div className="flex flex-col xl:flex-row xl:items-center gap-4">
        <div className={`h-11 w-11 shrink-0 rounded-xl border grid place-items-center ${severityClasses[alert.severity]}`}>
          <AlertTriangle className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{alert.title}</p>
            <Badge label={alert.severity} className={severityClasses[alert.severity]} />
            <Badge label={alert.status} className={statusClasses[alert.status]} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{statusExplanation[alert.status]}</p>
          <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>Merchant: <strong className="text-foreground">{alert.merchant || "Unknown"}</strong></span>
            <span>Amount: <strong className="text-foreground">{formatCurrency(alert.amount, alert.currency)}</strong></span>
            <span>Country: <strong className="text-foreground">{alert.country || "Unknown"}</strong></span>
            <span>Risk: <strong className="text-foreground">{alert.riskScore}/100</strong></span>
            {admin && <span>User: <strong className="text-foreground">{alert.userName ?? `User ${alert.userId}`} (#{alert.userId})</strong></span>}
            <span>Transaction: <strong className="text-foreground">TX-{alert.transactionId}</strong></span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(alert.createdAt)}</span>
          </div>
        </div>

        {admin && (
          <div className="flex flex-wrap items-end gap-2 xl:justify-end">
            <label className="glass min-w-40 rounded-lg px-3 py-2">
              <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">Update status</span>
              <div className="flex items-center gap-2">
                <select
                  value={alert.status}
                  disabled={updating}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    onStatus?.(event.target.value as AlertStatus);
                  }}
                  className="mt-0.5 flex-1 bg-transparent text-sm outline-none capitalize disabled:opacity-60"
                >
                  <option value="open" className="bg-card">Open</option>
                  <option value="investigating" className="bg-card">Investigating</option>
                  <option value="resolved" className="bg-card">Resolved</option>
                </select>
                {updating && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
              </div>
            </label>
            <button
              type="button"
              disabled={updating}
              onClick={(event) => {
                event.stopPropagation();
                onDelete();
              }}
              title="Delete alert"
              className="h-9 w-9 grid place-items-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

function AlertDetailsModal({ alert, onClose }: { alert: FraudAlertRecord; onClose: () => void }) {
  const factors = getAlertFactors(alert);
  const highRisk = alert.riskScore >= 70 || alert.severity === "high" || alert.severity === "critical";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="glass mx-auto my-8 w-full max-w-3xl rounded-2xl ring-1 ring-border">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Alert Details</p>
            <h2 className="font-display text-xl font-semibold">{alert.title}</h2>
          </div>
          <button type="button" onClick={onClose} title="Close alert details" className="h-9 w-9 grid place-items-center rounded-lg glass hover:ring-1 hover:ring-primary/40">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <AlertMetric label="Severity" value={alert.severity} />
            <AlertMetric label="Status" value={alert.status} />
            <AlertMetric label="Risk Score" value={`${alert.riskScore}/100`} />
            <AlertMetric label="Transaction ID" value={`TX-${alert.transactionId}`} />
            <AlertMetric label="Merchant" value={alert.merchant || "Unknown"} />
            <AlertMetric label="Amount" value={formatCurrency(alert.amount, alert.currency)} />
            <AlertMetric label="Country" value={alert.country || "Unknown"} />
            <AlertMetric label="Created Date" value={formatDate(alert.createdAt)} />
          </div>

          <ModalSection title="Alert Explanation">
            <p className="text-sm leading-6 text-muted-foreground">
              {highRisk
                ? "This alert was generated automatically because the transaction exceeded the configured fraud threshold and was classified as High Risk."
                : "This alert was generated automatically because the transaction requires additional review before it can be considered safe."}
            </p>
          </ModalSection>

          <ModalSection title="Analysis Factors">
            <ul className="grid sm:grid-cols-2 gap-2 text-sm">
              {factors.map((factor) => (
                <li key={factor} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                  {factor}
                </li>
              ))}
            </ul>
          </ModalSection>

          <ModalSection title="Recommended Action">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Review transaction history.</li>
              <li>Verify customer identity.</li>
              <li>Monitor future transactions for similar activity.</li>
            </ul>
          </ModalSection>
        </div>
      </div>
    </div>
  );
}

function AlertMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium capitalize">{value}</p>
    </div>
  );
}

function ModalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/50 bg-background/25 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function getAlertFactors(alert: FraudAlertRecord) {
  const factors: string[] = [];
  if (alert.amount > 3000) factors.push("High transaction amount.");
  if (alert.riskScore >= 70) factors.push("Elevated fraud score exceeded the fraud threshold.");
  if (alert.country) factors.push(`Destination country requires review: ${alert.country}.`);
  factors.push("Transaction pattern triggered automated fraud monitoring.");
  return factors;
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="glass rounded-lg px-3 py-2">
      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-0.5 w-full bg-transparent text-sm outline-none capitalize">
        {options.map((option) => <option key={option} value={option} className="bg-card capitalize">{option}</option>)}
      </select>
    </label>
  );
}

function Badge({ label, className }: { label: string; className: string }) {
  return <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${className}`}>{label}</span>;
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-2 text-2xl font-display font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function StateMessage({
  icon: Icon,
  message,
  spinning = false,
}: {
  icon: typeof ShieldAlert;
  message: string;
  spinning?: boolean;
}) {
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">
      <Icon className={`mx-auto mb-3 h-6 w-6 ${spinning ? "animate-spin" : "text-primary"}`} />
      {message}
    </div>
  );
}

function DeleteDialog({
  alert,
  deleting,
  onCancel,
  onConfirm,
}: {
  alert: FraudAlertRecord;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="glass w-full max-w-md rounded-2xl p-6 ring-1 ring-destructive/30">
        <p className="font-display text-lg font-semibold">Delete alert?</p>
        <p className="mt-2 text-sm text-muted-foreground">
          This permanently removes the alert for {alert.merchant || `transaction TX-${alert.transactionId}`}.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={deleting} onClick={onCancel} className="glass rounded-lg px-4 py-2 text-sm">Cancel</button>
          <button type="button" disabled={deleting} onClick={onConfirm} className="rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-50">
            {deleting ? "Deleting..." : "Delete alert"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(value ?? 0);
  } catch {
    return `${currency || "USD"} ${(value ?? 0).toFixed(2)}`;
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
