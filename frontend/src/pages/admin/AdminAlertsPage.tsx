import { Topbar } from "@/components/layout/Topbar";
import { alertService } from "@/services/alertService";
import type { FraudAlertRecord } from "@/types/alertApi";
import { AlertTriangle, Clock, Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/pages/transactions/TransactionsPage";

const sev: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-primary/15 text-primary border-primary/30",
};

export default function AdminAlerts() {
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

  return (
    <>
      <Topbar title="Fraud Alerts" subtitle="Operations security center" />
      <main className="flex-1 p-4 md:p-8">
        <div className="glass rounded-2xl">
          <div className="p-5 border-b border-border flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <p className="font-display font-semibold">All alerts</p>
          </div>
          {loading ? (
            <div className="p-8 text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading alerts...</div>
          ) : error ? (
            <div className="p-8 text-sm text-destructive">{error}</div>
          ) : alerts.length === 0 ? (
            <div className="p-8 text-sm text-muted-foreground">No alerts generated yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => (
                <div key={alert.id} className="p-5 flex flex-wrap items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl border grid place-items-center ${sev[alert.severity]}`}>
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{alert.title}</p>
                    <p className="text-xs text-muted-foreground">
                      TX-{alert.transactionId} - {alert.userName ?? `User ${alert.userId}`} - {alert.merchant} - {formatCurrency(alert.amount, alert.currency)} - Risk {alert.riskScore}/100
                    </p>
                  </div>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded border ${sev[alert.severity]}`}>{alert.severity}</span>
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(alert.createdAt).toLocaleString()}</div>
                  <StatusBadge s={alert.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
