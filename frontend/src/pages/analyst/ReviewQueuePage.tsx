import { FraudSelect } from "@/components/common/FraudSelect";
import { Topbar } from "@/components/layout/Topbar";
import { fraudCaseService } from "@/services/fraudCaseService";
import type { FraudCase, FraudCaseFilters } from "@/types/fraudCase";
import { formatCurrency } from "@/utils/formatters";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const initialFilters: FraudCaseFilters = { page: 1, pageSize: 10, sortBy: "createdAt", sortDirection: "desc" };

export default function ReviewQueuePage() {
  const [filters, setFilters] = useState<FraudCaseFilters>(initialFilters);
  const [items, setItems] = useState<FraudCase[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadCases();
  }, [filters.status, filters.priority, filters.transactionType, filters.minRisk, filters.maxRisk, filters.assigned, filters.fromDate, filters.toDate, filters.sortBy, filters.sortDirection, filters.page]);

  async function loadCases() {
    setLoading(true);
    setError(null);
    try {
      const response = await fraudCaseService.getCases(filters);
      setItems(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load review queue.");
    } finally {
      setLoading(false);
    }
  }

  async function claim(id: number) {
    setProcessingId(id);
    try {
      await fraudCaseService.claim(id);
      toast.success(`Case FC-${id} claimed.`);
      await loadCases();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to claim case.");
    } finally {
      setProcessingId(null);
    }
  }

  const page = Number(filters.page ?? 1);
  const pageSize = Number(filters.pageSize ?? 10);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <Topbar title="Review Queue" subtitle={`${total} fraud case${total === 1 ? "" : "s"}`} />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 space-y-4">
        <div className="glass rounded-2xl p-4 grid gap-3 lg:grid-cols-6">
          <Select label="Status" value={filters.status ?? "all"} options={["all", "Open", "Assigned", "UnderReview", "Escalated", "Resolved"]} onChange={(status) => setFilters({ ...filters, status, page: 1 })} />
          <Select label="Priority" value={filters.priority ?? "all"} options={["all", "Critical", "High", "Medium", "Low"]} onChange={(priority) => setFilters({ ...filters, priority, page: 1 })} />
          <Select label="Type" value={filters.transactionType ?? "all"} options={["all", "PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT"]} onChange={(transactionType) => setFilters({ ...filters, transactionType, page: 1 })} />
          <Select label="Assignment" value={filters.assigned ?? "all"} options={["all", "mine", "unassigned"]} onChange={(assigned) => setFilters({ ...filters, assigned, page: 1 })} />
          <Field label="Min risk" value={filters.minRisk ?? ""} onChange={(minRisk) => setFilters({ ...filters, minRisk, page: 1 })} />
          <Field label="Max risk" value={filters.maxRisk ?? ""} onChange={(maxRisk) => setFilters({ ...filters, maxRisk, page: 1 })} />
          <Field label="From" type="date" value={filters.fromDate ?? ""} onChange={(fromDate) => setFilters({ ...filters, fromDate, page: 1 })} />
          <Field label="To" type="date" value={filters.toDate ?? ""} onChange={(toDate) => setFilters({ ...filters, toDate, page: 1 })} />
          <Select label="Sort" value={filters.sortBy ?? "createdAt"} options={["createdAt", "risk", "priority", "status"]} onChange={(sortBy) => setFilters({ ...filters, sortBy })} />
          <Select label="Direction" value={filters.sortDirection ?? "desc"} options={["desc", "asc"]} onChange={(sortDirection) => setFilters({ ...filters, sortDirection })} />
        </div>

        {loading && <StatePanel title="Loading review queue" message="Fetching fraud cases." />}
        {!loading && error && <StatePanel title="Review queue unavailable" message={error} destructive />}
        {!loading && !error && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><Th>Case ID</Th><Th>Transaction</Th><Th>Customer</Th><Th>Amount</Th><Th>Type</Th><Th>Risk</Th><Th>Priority</Th><Th>Status</Th><Th>Assigned</Th><Th>Created</Th><Th>Action</Th></tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">No cases match these filters</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.id} className="border-t border-border">
                      <Td>FC-{item.id}</Td>
                      <Td>TX-{item.transactionId}</Td>
                      <Td>{item.customerName}</Td>
                      <Td>{formatCurrency(item.amount, item.currency)}</Td>
                      <Td>{item.transactionType}</Td>
                      <Td>{item.modelRiskScore}/100</Td>
                      <Td><Badge value={item.priority} /></Td>
                      <Td><Badge value={item.status} /></Td>
                      <Td>{item.assignedAnalystName ?? "Unassigned"}</Td>
                      <Td>{new Date(item.createdAt).toLocaleString()}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          {!item.assignedAnalystId && (
                            <button disabled={processingId === item.id} onClick={() => void claim(item.id)} className="glass rounded-lg px-2 py-1 text-xs hover:ring-1 hover:ring-primary/40 disabled:opacity-60">
                              {processingId === item.id ? "Claiming" : "Claim"}
                            </button>
                          )}
                          <Link to="/analyst/investigations/$caseId" params={{ caseId: String(item.id) }} className="text-primary hover:underline">Review</Link>
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border p-4 text-sm">
              <span className="text-muted-foreground">Page {page} of {pageCount}</span>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setFilters({ ...filters, page: page - 1 })} className="glass rounded-lg px-3 py-2 disabled:opacity-50">Previous</button>
                <button disabled={page >= pageCount} onClick={() => setFilters({ ...filters, page: page + 1 })} className="glass rounded-lg px-3 py-2 disabled:opacity-50">Next</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <FraudSelect value={value} onValueChange={onChange} options={options.map((option) => ({ value: option, label: option }))} ariaLabel={label} triggerClassName="mt-1 min-h-10 w-full px-3 py-2 text-sm" />
    </label>
  );
}

function Field({ label, value, onChange, type = "number" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full glass rounded-lg bg-transparent px-3 text-sm outline-none focus:ring-1 focus:ring-primary/60" />
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-left font-medium">{children}</th>; }
function Td({ children }: { children: React.ReactNode }) { return <td className="px-4 py-3">{children}</td>; }

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
