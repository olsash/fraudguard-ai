import { Topbar } from "@/components/layout/Topbar";
import { fraudCaseService } from "@/services/fraudCaseService";
import type { FraudCase, FraudCaseSummary } from "@/types/fraudCase";
import { formatCurrency } from "@/utils/formatters";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, FileSearch, Loader2, ShieldAlert, UserCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";

export default function AnalystDashboardPage() {
  const [summary, setSummary] = useState<FraudCaseSummary | null>(null);
  const [cases, setCases] = useState<FraudCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [summaryRow, queue] = await Promise.all([
          fraudCaseService.getSummary(),
          fraudCaseService.getCases({ pageSize: 8, sortBy: "createdAt", sortDirection: "desc" }),
        ]);
        setSummary(summaryRow);
        setCases(queue.items);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load analyst dashboard.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const cards = [
    { label: "Open Cases", value: summary?.openCases ?? 0, icon: FileSearch },
    { label: "Under Review", value: summary?.underReviewCases ?? 0, icon: Clock3 },
    { label: "Assigned to Me", value: summary?.assignedToMe ?? 0, icon: UserCheck },
    { label: "High-Risk Transactions", value: summary?.highRiskTransactions ?? 0, icon: ShieldAlert },
    { label: "Unassigned Cases", value: summary?.unassignedCases ?? 0, icon: Users },
    { label: "Cases Resolved Today", value: summary?.casesResolvedToday ?? 0, icon: CheckCircle2 },
    { label: "Average Review Time", value: `${summary?.averageReviewTimeMinutes ?? 0}m`, icon: Clock3 },
    { label: "Confirmed Fraud Cases", value: summary?.confirmedFraudCases ?? 0, icon: AlertTriangle },
    { label: "False Positives", value: summary?.falsePositiveCases ?? 0, icon: CheckCircle2 },
  ];

  return (
    <>
      <Topbar title="Analyst Dashboard" subtitle="Fraud review queue and investigation activity" />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 space-y-4">
        {loading && <StatePanel title="Loading analyst dashboard" message="Fetching fraud case metrics." />}
        {!loading && error && <StatePanel title="Analyst dashboard unavailable" message={error} destructive />}
        {!loading && !error && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {cards.map((card) => (
                <div key={card.label} className="glass rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">{card.label}</p>
                      <p className="mt-2 font-display text-2xl font-semibold">{card.value}</p>
                    </div>
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
                      <card.icon className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <p className="font-display font-semibold">Review Queue</p>
                  <p className="text-xs text-muted-foreground">Transactions waiting for analyst review</p>
                </div>
                <Link to="/analyst/review-queue" className="glass rounded-lg px-3 py-2 text-sm hover:ring-1 hover:ring-primary/40">Open queue</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-sm">
                  <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr><Th>Case</Th><Th>Customer</Th><Th>Amount</Th><Th>Type</Th><Th>Risk</Th><Th>Status</Th><Th>Created</Th><Th /></tr>
                  </thead>
                  <tbody>
                    {cases.length === 0 ? (
                      <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No open fraud cases</td></tr>
                    ) : cases.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <Td>FC-{item.id}</Td>
                        <Td>{item.customerName}</Td>
                        <Td>{formatCurrency(item.amount, item.currency)}</Td>
                        <Td>{item.transactionType}</Td>
                        <Td>{item.modelRiskScore}/100</Td>
                        <Td>{item.status}</Td>
                        <Td>{new Date(item.createdAt).toLocaleString()}</Td>
                        <Td><Link to="/analyst/investigations/$caseId" params={{ caseId: String(item.id) }} className="text-primary hover:underline">Review</Link></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
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
