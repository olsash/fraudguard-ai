import { AnalystDecisionDialog } from "@/components/analyst/AnalystDecisionDialog";
import { FraudSelect } from "@/components/common/FraudSelect";
import { Topbar } from "@/components/layout/Topbar";
import { fraudCaseService } from "@/services/fraudCaseService";
import type { FraudCase, FraudCaseFilters } from "@/types/fraudCase";
import { formatCurrency } from "@/utils/formatters";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, ShieldAlert, UserCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type AlertScope = "mine" | "unassigned" | "resolved" | "reviewable";

const scopeTabs: Array<{ value: AlertScope; label: string; empty: string }> = [
  { value: "mine", label: "My Alerts", empty: "No active alerts are currently assigned to you." },
  { value: "unassigned", label: "Unassigned", empty: "No unassigned fraud alerts currently require review." },
  { value: "resolved", label: "Resolved", empty: "You have not resolved any fraud alerts yet." },
  { value: "reviewable", label: "All Reviewable", empty: "No fraud alerts currently require review." },
];

export default function AnalystAlertsPage() {
  const [scope, setScope] = useState<AlertScope>("mine");
  const [filters, setFilters] = useState<FraudCaseFilters>({ page: 1, pageSize: 20 });
  const [items, setItems] = useState<FraudCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [claimCase, setClaimCase] = useState<FraudCase | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAlerts();
  }, [scope, filters.search, filters.status, filters.priority, filters.transactionType, filters.minRisk, filters.maxRisk, filters.from, filters.to]);

  async function loadAlerts() {
    setLoading(true);
    setError(null);
    try {
      const response = await fraudCaseService.getAnalystAlerts({ ...filters, scope });
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load analyst alerts.");
    } finally {
      setLoading(false);
    }
  }

  async function claim(id: number) {
    setProcessingId(id);
    try {
      await fraudCaseService.claim(id);
      setClaimCase(null);
      toast.success("Case claimed and review started.");
      await loadAlerts();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to claim case.";
      toast.error(message.includes("already") ? "This case has already been claimed by another analyst." : message);
    } finally {
      setProcessingId(null);
    }
  }

  const stats = useMemo(() => ({
    assigned: items.filter((item) => item.canReview && item.status !== "Resolved").length,
    unassigned: items.filter((item) => item.canClaim).length,
    high: items.filter((item) => item.modelRiskScore >= 70 && item.canReview).length,
    resolvedToday: items.filter((item) => item.resolvedAt && new Date(item.resolvedAt).toDateString() === new Date().toDateString()).length,
  }), [items]);

  const empty = scopeTabs.find((tab) => tab.value === scope)?.empty ?? "No alerts found.";

  return (
    <>
      <Topbar title="Fraud Alerts" subtitle="Review alerts assigned to you and claim unassigned security cases." />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Assigned to Me" value={stats.assigned} icon={UserCheck} />
          <Stat label="Unassigned Alerts" value={stats.unassigned} icon={Users} />
          <Stat label="High-Risk Assigned" value={stats.high} icon={ShieldAlert} />
          <Stat label="Resolved Today" value={stats.resolvedToday} icon={CheckCircle2} />
        </div>

        <div className="glass rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {scopeTabs.map((tab) => (
              <button key={tab.value} onClick={() => setScope(tab.value)} className={`rounded-lg px-3 py-2 text-sm ${scope === tab.value ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-6">
            <Field label="Search" type="text" value={filters.search ?? ""} onChange={(search) => setFilters({ ...filters, search })} />
            <Select label="Case Status" value={filters.status ?? "all"} options={["all", "Open", "UnderReview", "Resolved"]} onChange={(status) => setFilters({ ...filters, status })} />
            <Select label="Priority" value={filters.priority ?? "all"} options={["all", "Critical", "High", "Medium", "Low"]} onChange={(priority) => setFilters({ ...filters, priority })} />
            <Select label="Type" value={filters.transactionType ?? "all"} options={["all", "PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT"]} onChange={(transactionType) => setFilters({ ...filters, transactionType })} />
            <Field label="Min risk" value={filters.minRisk ?? ""} onChange={(minRisk) => setFilters({ ...filters, minRisk })} />
            <Field label="Max risk" value={filters.maxRisk ?? ""} onChange={(maxRisk) => setFilters({ ...filters, maxRisk })} />
          </div>
        </div>

        {loading && <StatePanel title="Loading fraud alerts" message="Fetching case-linked alert records." />}
        {!loading && error && <StatePanel title="Fraud alerts unavailable" message={error} destructive />}
        {!loading && !error && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><Th>Alert</Th><Th>Case</Th><Th>Transaction</Th><Th>Customer</Th><Th>Counterparty</Th><Th>Amount</Th><Th>Risk</Th><Th>Severity</Th><Th>Case Status</Th><Th>Assigned</Th><Th>Created</Th><Th>Action</Th></tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">{empty}</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-secondary/30">
                      <Td>{item.fraudAlertId ? `AL-${item.fraudAlertId}` : "Linked alert"}</Td>
                      <Td>{item.caseReference}</Td>
                      <Td>{item.transactionReference}</Td>
                      <Td>{item.customerName}</Td>
                      <Td>{counterparty(item)}</Td>
                      <Td>{formatCurrency(item.amount, item.currency)}</Td>
                      <Td>{item.modelRiskScore}/100</Td>
                      <Td><Badge value={item.alertSeverity ?? item.priority} /></Td>
                      <Td><Badge value={displayState(item)} /></Td>
                      <Td>{item.assignedAnalystName ?? "Unassigned"}</Td>
                      <Td>{new Date(item.createdAt).toLocaleString()}</Td>
                      <Td><Actions item={item} onClaim={setClaimCase} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <AnalystDecisionDialog
        caseItem={claimCase}
        decision={claimCase ? "claim" : null}
        loading={Boolean(claimCase && processingId === claimCase.id)}
        onOpenChange={(open) => {
          if (!open) setClaimCase(null);
        }}
        onConfirm={() => claimCase ? claim(claimCase.id) : Promise.resolve()}
      />
    </>
  );
}

function Actions({ item, onClaim }: { item: FraudCase; onClaim: (item: FraudCase) => void }) {
  if (item.canClaim) {
    return <div className="flex gap-2"><button onClick={() => onClaim(item)} className="glass rounded-lg px-2 py-1 text-xs">Claim Case</button><DetailLink item={item} readonly /></div>;
  }

  return <DetailLink item={item} readonly={!item.canReview || item.status === "Resolved"} label={item.status === "Resolved" ? "View Decision" : item.canReview ? "Continue Investigation" : "View Read-Only"} />;
}

function DetailLink({ item, readonly, label = "View Read-Only" }: { item: FraudCase; readonly?: boolean; label?: string }) {
  return <Link to="/analyst/investigations/$caseId" params={{ caseId: String(item.id) }} search={readonly ? { mode: "readonly" } : undefined} className="text-primary hover:underline">{label}</Link>;
}

function counterparty(item: FraudCase) {
  return item.transactionType === "PAYMENT" ? item.merchant || item.merchantCode || "Merchant" : item.beneficiaryName ?? item.destinationAccount ?? "Recipient";
}

function displayState(item: FraudCase) {
  if (item.status === "Resolved") return item.finalDecision ? `Resolved / ${item.finalDecision}` : "Resolved";
  if (item.status === "UnderReview") return "Under analyst review";
  return item.assignedAnalystId ? "Assigned to analyst" : "Unassigned security review";
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof ShieldAlert }) {
  return <div className="glass rounded-2xl p-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-semibold">{value}</p></div><Icon className="h-5 w-5 text-primary" /></div></div>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label><span className="text-xs text-muted-foreground">{label}</span><FraudSelect value={value} onValueChange={onChange} options={options.map((option) => ({ value: option, label: option }))} ariaLabel={label} triggerClassName="mt-1 min-h-10 w-full px-3 py-2 text-sm" /></label>;
}

function Field({ label, value, onChange, type = "number" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label><span className="text-xs text-muted-foreground">{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full glass rounded-lg bg-transparent px-3 text-sm outline-none focus:ring-1 focus:ring-primary/60" /></label>;
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-left font-medium">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3">{children}</td>; }
function Badge({ value }: { value: string }) { return <span className="rounded-md bg-primary/15 px-2 py-1 text-[10px] uppercase tracking-wider text-primary">{value}</span>; }
function StatePanel({ title, message, destructive }: { title: string; message: string; destructive?: boolean }) {
  return <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>{!destructive && <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}<h2 className="mt-4 font-display text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{message}</p></div>;
}
