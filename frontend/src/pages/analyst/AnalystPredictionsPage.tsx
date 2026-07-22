import { AnalystDecisionDialog } from "@/components/analyst/AnalystDecisionDialog";
import { FraudSelect } from "@/components/common/FraudSelect";
import { Topbar } from "@/components/layout/Topbar";
import { fraudCaseService } from "@/services/fraudCaseService";
import type { FraudCase, FraudCaseFilters } from "@/types/fraudCase";
import { formatCurrency } from "@/utils/formatters";
import { Link } from "@tanstack/react-router";
import { BrainCircuit, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type PredictionScope = "reviewRequired" | "mine" | "unassigned" | "resolved";

const tabs: Array<{ value: PredictionScope; label: string; empty: string }> = [
  { value: "reviewRequired", label: "Review Required", empty: "No model predictions currently require analyst review." },
  { value: "mine", label: "Assigned to Me", empty: "No review-required predictions are assigned to you." },
  { value: "unassigned", label: "Unassigned", empty: "No unassigned model predictions currently require review." },
  { value: "resolved", label: "Resolved by Me", empty: "You have not resolved any model predictions yet." },
];

export default function AnalystPredictionsPage() {
  const [scope, setScope] = useState<PredictionScope>("reviewRequired");
  const [filters, setFilters] = useState<FraudCaseFilters & { modelResult?: string; riskLevel?: string }>({ page: 1, pageSize: 20 });
  const [items, setItems] = useState<FraudCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimCase, setClaimCase] = useState<FraudCase | null>(null);
  const [processingId, setProcessingId] = useState<number | null>(null);

  useEffect(() => {
    void loadPredictions();
  }, [scope, filters.search, filters.status, filters.transactionType, filters.modelResult, filters.riskLevel]);

  async function loadPredictions() {
    setLoading(true);
    setError(null);
    try {
      const response = await fraudCaseService.getAnalystPredictions({ ...filters, scope });
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load analyst predictions.");
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
      await loadPredictions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to claim case.");
    } finally {
      setProcessingId(null);
    }
  }

  const empty = tabs.find((tab) => tab.value === scope)?.empty ?? "No predictions found.";

  return (
    <>
      <Topbar title="Predictions" subtitle="Review-required model outputs linked to fraud investigations" />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 space-y-4">
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <BrainCircuit className="h-5 w-5 text-primary" />
            <div><p className="font-display font-semibold">Analyst prediction worklist</p><p className="text-xs text-muted-foreground">Safe automated predictions are excluded from the default analyst view.</p></div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {tabs.map((tab) => <button key={tab.value} onClick={() => setScope(tab.value)} className={`rounded-lg px-3 py-2 text-sm ${scope === tab.value ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}>{tab.label}</button>)}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-5">
            <Field label="Search" type="text" value={filters.search ?? ""} onChange={(search) => setFilters({ ...filters, search })} />
            <Select label="Model result" value={filters.modelResult ?? "all"} options={["all", "fraud", "not_fraud"]} onChange={(modelResult) => setFilters({ ...filters, modelResult })} />
            <Select label="Risk" value={filters.riskLevel ?? "all"} options={["all", "medium", "high"]} onChange={(riskLevel) => setFilters({ ...filters, riskLevel })} />
            <Select label="Case Status" value={filters.status ?? "all"} options={["all", "Open", "UnderReview", "Resolved"]} onChange={(status) => setFilters({ ...filters, status })} />
            <Select label="Type" value={filters.transactionType ?? "all"} options={["all", "PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT"]} onChange={(transactionType) => setFilters({ ...filters, transactionType })} />
          </div>
        </section>

        {loading && <StatePanel title="Loading predictions" message="Fetching review-required model predictions." />}
        {!loading && error && <StatePanel title="Predictions unavailable" message={error} destructive />}
        {!loading && !error && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><Th>Prediction</Th><Th>Case</Th><Th>Transaction</Th><Th>Customer</Th><Th>Counterparty</Th><Th>Type</Th><Th>Amount</Th><Th>Model Result</Th><Th>Risk</Th><Th>Priority</Th><Th>Status</Th><Th>Assigned</Th><Th>Created</Th><Th>Action</Th></tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={14} className="px-4 py-10 text-center text-muted-foreground">{empty}</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-secondary/30">
                      <Td>{item.predictionId ? `PR-${item.predictionId}` : "Prediction"}</Td>
                      <Td>{item.caseReference}</Td>
                      <Td>{item.transactionReference}</Td>
                      <Td>{item.customerName}</Td>
                      <Td>{item.transactionType === "PAYMENT" ? item.merchant : item.beneficiaryName ?? item.destinationAccount ?? "Recipient"}</Td>
                      <Td>{item.transactionType}</Td>
                      <Td>{formatCurrency(item.amount, item.currency)}</Td>
                      <Td>{item.predictedClass ?? item.modelDecision}</Td>
                      <Td>{item.modelRiskScore}/100</Td>
                      <Td><Badge value={item.priority} /></Td>
                      <Td><Badge value={item.status} /></Td>
                      <Td>{item.assignedAnalystName ?? "Unassigned"}</Td>
                      <Td>{item.predictionCreatedAt ? new Date(item.predictionCreatedAt).toLocaleString() : new Date(item.createdAt).toLocaleString()}</Td>
                      <Td><Actions item={item} onClaim={setClaimCase} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <AnalystDecisionDialog caseItem={claimCase} decision={claimCase ? "claim" : null} loading={Boolean(claimCase && processingId === claimCase.id)} onOpenChange={(open) => !open && setClaimCase(null)} onConfirm={() => claimCase ? claim(claimCase.id) : Promise.resolve()} />
    </>
  );
}

function Actions({ item, onClaim }: { item: FraudCase; onClaim: (item: FraudCase) => void }) {
  if (item.canClaim) return <div className="flex gap-2"><button onClick={() => onClaim(item)} className="glass rounded-lg px-2 py-1 text-xs">Claim Case</button><DetailLink item={item} readonly /></div>;
  return <DetailLink item={item} readonly={!item.canReview || item.status === "Resolved"} label={item.status === "Resolved" ? "View Decision" : item.canReview ? "Continue Investigation" : "View Read-Only"} />;
}

function DetailLink({ item, readonly, label = "View Read-Only" }: { item: FraudCase; readonly?: boolean; label?: string }) {
  return <Link to="/analyst/investigations/$caseId" params={{ caseId: String(item.id) }} search={readonly ? { mode: "readonly" } : undefined} className="text-primary hover:underline">{label}</Link>;
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
