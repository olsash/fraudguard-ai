import { Topbar } from "@/components/layout/Topbar";
import { alertService } from "@/services/alertService";
import type { FraudAlertRecord } from "@/types/alertApi";
import { AlertTriangle, ChevronRight, Clock, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/pages/transactions/TransactionsPage";

const sevColor: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-primary/15 text-primary border-primary/30",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<FraudAlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAlerts() {
      try {
        setAlerts(await alertService.getAlerts());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load alerts.");
      } finally {
        setLoading(false);
      }
    }
    void loadAlerts();
  }, []);

  const openCount = alerts.filter((alert) => alert.status === "open").length;
  const reviewCount = alerts.filter((alert) => alert.severity === "medium").length;
  const highCount = alerts.filter((alert) => alert.severity === "high" || alert.severity === "critical").length;

  return (
    <>
      <Topbar title="Fraud Alert Center" subtitle="Transaction risk triage" />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Open alerts" value={openCount} tone="destructive" />
          <Stat label="Review alerts" value={reviewCount} tone="warning" />
          <Stat label="High risk" value={highCount} tone="destructive" />
          <Stat label="Total alerts" value={alerts.length} tone="primary" />
        </div>

        <div className="glass rounded-2xl">
          <div className="p-5 border-b border-border flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-display font-semibold">Active alerts</p>
              <p className="text-xs text-muted-foreground">Created automatically after review or fraud analysis results</p>
            </div>
          </div>
          <AlertList alerts={alerts} loading={loading} error={error} />
        </div>
      </main>
    </>
  );
}

function AlertList({ alerts, loading, error }: { alerts: FraudAlertRecord[]; loading: boolean; error: string | null }) {
  if (loading) return <div className="p-8 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading alerts...</div>;
  if (error) return <div className="p-8 text-sm text-destructive">{error}</div>;
  if (alerts.length === 0) return <div className="p-8 text-sm text-muted-foreground">No alerts generated yet.</div>;

  return (
    <div className="divide-y divide-border">
      {alerts.map((alert) => (
        <div key={alert.id} className="p-5 flex flex-wrap items-center gap-4 hover:bg-secondary/30 transition">
          <div className={`h-10 w-10 rounded-xl border grid place-items-center ${sevColor[alert.severity]}`}>
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate">{alert.title}</p>
              <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${sevColor[alert.severity]}`}>{alert.severity}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              TX-{alert.transactionId} - {alert.merchant} - {formatCurrency(alert.amount, alert.currency)} - Risk {alert.riskScore}/100
            </p>
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(alert.createdAt).toLocaleString()}</div>
          <StatusBadge s={alert.status} />
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <div className="glass rounded-2xl p-5"><p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-display font-semibold text-${tone}`}>{value}</p></div>;
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
