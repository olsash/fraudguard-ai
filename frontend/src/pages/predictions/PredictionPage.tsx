import { Topbar } from "@/components/layout/Topbar";
import { predictionService } from "@/services/predictionService";
import { transactionService } from "@/services/transactionService";
import type { PredictionInput, PredictionResult, TransactionType } from "@/types/prediction";
import type { Transaction } from "@/types/transaction";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Cpu,
  CreditCard,
  History,
  Loader2,
  ShieldCheck,
  Sparkles,
  WalletCards,
  Zap,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

const transactionTypes: TransactionType[] = ["CASH_IN", "CASH_OUT", "DEBIT", "PAYMENT", "TRANSFER"];
const initialForm = {
  transactionType: "TRANSFER" as TransactionType,
  amount: "1240",
  oldBalanceOrigin: "5200",
  newBalanceOrigin: "3960",
  oldBalanceDestination: "800",
  newBalanceDestination: "2040",
};

type PredictionForm = typeof initialForm;

export default function Predict() {
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<PredictionResult[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [form, setForm] = useState<PredictionForm>(initialForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadHistory();
    void loadTransactions();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      setHistory(await predictionService.getMyHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load prediction history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadTransactions() {
    try {
      const rows = await transactionService.getTransactions();
      setTransactions(rows);
      setSelectedTransaction((current) => current ? rows.find((item) => item.id === current.id) ?? current : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load transactions.");
    }
  }

  async function analyzeSelectedTransaction() {
    if (!selectedTransaction) {
      setError("Choose a transaction first.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const analysis = await predictionService.predictTransaction(selectedTransaction.id);
      const [refreshedTransaction, refreshedHistory] = await Promise.all([
        transactionService.getTransactionById(selectedTransaction.id),
        predictionService.getMyHistory(),
      ]);
      setSelectedTransaction(refreshedTransaction);
      setTransactions((current) => current.map((item) => item.id === refreshedTransaction.id ? refreshedTransaction : item));
      setHistory(refreshedHistory);
      setResult(refreshedHistory.find((item) => item.id === analysis.predictionId) ?? null);
      toast.success("Transaction analysis completed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to analyze transaction.");
    } finally {
      setLoading(false);
    }
  }

  const updateForm = (key: keyof PredictionForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const runAdvancedPrediction = async (event: FormEvent) => {
    event.preventDefault();
    const request = toAdvancedRequest(form);
    if (!request) {
      setError("Enter valid non-negative numbers for every balance and amount field.");
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const prediction = await predictionService.predict(request);
      setResult(prediction);
      setHistory((current) => [prediction, ...current.filter((item) => item.id !== prediction.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run advanced model test.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar title="Fraud Analysis" subtitle="Analyze saved transactions and monitor risk decisions" />
      <main className="flex-1 p-4 md:p-8 grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 space-y-5">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-display font-semibold">Select Transaction</h2>
                <p className="text-xs text-muted-foreground">Transaction to analysis to result to alert.</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <label className="block">
              <span className="text-xs text-muted-foreground">Choose existing transaction</span>
              <select
                value={selectedTransaction?.id ?? ""}
                onChange={(event) => setSelectedTransaction(transactions.find((item) => item.id === Number(event.target.value)) ?? null)}
                className="mt-1 w-full glass rounded-lg px-3 py-3 text-sm bg-background outline-none"
              >
                <option value="">Select transaction</option>
                {transactions.map((transaction) => (
                  <option key={transaction.id} value={transaction.id}>
                    TX-{transaction.id} - {transaction.merchant} - {formatCurrency(transaction.amount, transaction.currency)}
                  </option>
                ))}
              </select>
            </label>

            <div className="mt-5">
              {selectedTransaction ? (
                <TransactionSummaryCard transaction={selectedTransaction} />
              ) : (
                <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
                  Select a transaction to analyze fraud risk from saved merchant, category, country, amount, and type.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void analyzeSelectedTransaction()}
              disabled={!selectedTransaction || loading}
              className="mt-6 w-full bg-gradient-primary text-primary-foreground rounded-lg py-3 font-medium ring-glow flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing transaction...</> : <><Zap className="h-4 w-4" /> Analyze Transaction</>}
            </button>
          </div>

          <div className="glass rounded-2xl p-5">
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="w-full flex items-center justify-between text-left"
            >
              <div>
                <p className="font-display font-semibold">Advanced Model Testing</p>
                <p className="text-xs text-muted-foreground">Hidden PaySim fields for model validation only.</p>
              </div>
              <ChevronDown className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`} />
            </button>
            {advancedOpen && (
              <form onSubmit={runAdvancedPrediction} className="mt-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <Select label="Transaction Type" icon={WalletCards} value={form.transactionType} options={transactionTypes} onChange={(value) => updateForm("transactionType", value)} />
                  <Input label="Amount" icon={CreditCard} value={form.amount} onChange={(value) => updateForm("amount", value)} />
                  <Input label="Old Balance Origin" value={form.oldBalanceOrigin} onChange={(value) => updateForm("oldBalanceOrigin", value)} />
                  <Input label="New Balance Origin" value={form.newBalanceOrigin} onChange={(value) => updateForm("newBalanceOrigin", value)} />
                  <Input label="Old Balance Destination" value={form.oldBalanceDestination} onChange={(value) => updateForm("oldBalanceDestination", value)} />
                  <Input label="New Balance Destination" value={form.newBalanceDestination} onChange={(value) => updateForm("newBalanceDestination", value)} />
                </div>
                <button type="submit" disabled={loading} className="mt-6 w-full glass rounded-lg py-3 text-sm hover:ring-1 hover:ring-primary/40 disabled:opacity-60">
                  Run Advanced Model Test
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <ResultPanel loading={loading} result={result} />
          <HistoryPanel loading={historyLoading} history={history} onSelectTransaction={(id) => setSelectedTransaction(transactions.find((item) => item.id === id) ?? selectedTransaction)} />
        </section>
      </main>
    </>
  );
}

function toAdvancedRequest(form: PredictionForm): PredictionInput | null {
  const request = {
    transactionType: form.transactionType,
    amount: Number(form.amount),
    oldBalanceOrigin: Number(form.oldBalanceOrigin),
    newBalanceOrigin: Number(form.newBalanceOrigin),
    oldBalanceDestination: Number(form.oldBalanceDestination),
    newBalanceDestination: Number(form.newBalanceDestination),
  };

  const invalid = Object.entries(request).some(([key, value]) => key !== "transactionType" && (!Number.isFinite(value) || Number(value) < 0));
  return invalid ? null : request;
}

function TransactionSummaryCard({ transaction }: { transaction: Transaction }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Selected transaction</p>
          <p className="font-display text-lg font-semibold">{transaction.merchant}</p>
        </div>
        <StatusPill status={transaction.status} />
      </div>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <SummaryMetric label="Merchant" value={transaction.merchant} />
        <SummaryMetric label="Category" value={transaction.category} />
        <SummaryMetric label="Country" value={transaction.country} />
        <SummaryMetric label="Amount" value={formatCurrency(transaction.amount, transaction.currency)} />
        <SummaryMetric label="Currency" value={transaction.currency} />
        <SummaryMetric label="Transaction Type" value={transaction.transactionType} />
        <SummaryMetric label="Current Risk Score" value={transaction.riskScore == null ? "Pending" : `${transaction.riskScore}/100`} />
        <SummaryMetric label="Current Status" value={transaction.status} />
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/30 border border-border/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color = {
    pending: "bg-primary/15 text-primary",
    safe: "bg-success/15 text-success",
    review: "bg-warning/15 text-warning",
    fraud: "bg-destructive/15 text-destructive",
  }[status] ?? "bg-secondary text-muted-foreground";
  return <span className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wider ${color}`}>{status}</span>;
}

function Input({ label, icon: Icon, value, onChange }: { label: string; icon?: typeof CreditCard; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center glass rounded-lg px-3 py-2.5 focus-within:ring-1 focus-within:ring-primary/60">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground mr-2" />}
        <input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
      </div>
    </label>
  );
}

function Select({ label, icon: Icon, value, options, onChange }: { label: string; icon?: typeof WalletCards; value: TransactionType; options: TransactionType[]; onChange: (value: TransactionType) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center glass rounded-lg px-3 py-2.5">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground mr-2" />}
        <select value={value} onChange={(event) => onChange(event.target.value as TransactionType)} className="flex-1 bg-transparent text-sm outline-none appearance-none">
          {options.map((option) => <option key={option} value={option} className="bg-card">{option}</option>)}
        </select>
      </div>
    </label>
  );
}

function ResultPanel({ loading, result }: { loading: boolean; result: PredictionResult | null }) {
  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 text-center relative overflow-hidden h-80 grid place-items-center">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
        <div>
          <div className="mx-auto h-20 w-20 rounded-full bg-gradient-primary grid place-items-center animate-pulse-glow">
            <Cpu className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="mt-5 font-display font-semibold">Analyzing transaction...</p>
          <p className="text-xs text-muted-foreground">Scoring saved transaction data</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass rounded-2xl p-8 text-center h-80 grid place-items-center">
        <div>
          <ShieldCheck className="h-10 w-10 mx-auto text-primary" />
          <p className="mt-3 font-display font-semibold">Ready to analyze</p>
          <p className="text-xs text-muted-foreground">Select a transaction and run analysis</p>
        </div>
      </div>
    );
  }

  const status = getPredictionStatus(result);
  const tone = getStatusTone(status);
  const factorGroups = groupAnalysisFactors(result.reasons, status);

  return (
    <div className={`glass rounded-2xl p-6 relative overflow-hidden ring-1 ${tone.ring}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tone.background} to-transparent pointer-events-none`} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Analysis Result</p>
            <p className={`mt-1 text-2xl font-display font-semibold ${tone.text}`}>
              {formatStatus(status)}
            </p>
          </div>
          {status === "fraud" ? (
            <AlertTriangle className="h-8 w-8 text-destructive animate-pulse-glow" />
          ) : (
            <ShieldCheck className={`h-8 w-8 ${tone.text}`} />
          )}
        </div>
        <div className="mt-6">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Risk score</span>
            <span>{result.riskScore}/100</span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full ${result.riskScore >= 70 ? "bg-destructive" : result.riskScore >= 40 ? "bg-warning" : "bg-success"}`} style={{ width: `${result.riskScore}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 text-center text-xs">
            <Metric label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
            <Metric label="Risk level" value={result.riskLevel} />
          </div>
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">Why This Score?</p>
          <div className="space-y-4">
            {factorGroups.map((group) => (
              <div key={group.title}>
                <p className={`mb-2 text-xs font-semibold uppercase tracking-widest ${group.color}`}>{group.title}</p>
                <ul className="space-y-2 text-sm text-foreground/90">
                  {group.items.map((reason) => (
                    <li key={`${group.title}-${reason}`} className="flex gap-2">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${group.dot}`} />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className={`mt-5 rounded-lg p-3 text-sm ${tone.action}`}>
          <span className="font-semibold">Suggested action:</span> {result.suggestedAction}
        </div>
      </div>
    </div>
  );
}

type AnalysisStatus = "safe" | "review" | "fraud";

function getPredictionStatus(result: PredictionResult): AnalysisStatus {
  const status = result.transactionStatus?.toLowerCase();
  if (status === "safe" || status === "review" || status === "fraud") {
    return status;
  }

  if (result.riskScore >= 70 || result.isFraud) {
    return "fraud";
  }

  return result.riskScore >= 40 ? "review" : "safe";
}

function getStatusTone(status: AnalysisStatus) {
  if (status === "fraud") {
    return {
      ring: "ring-destructive/50",
      background: "from-destructive/20",
      text: "text-destructive",
      action: "bg-destructive/10 text-destructive",
    };
  }

  if (status === "review") {
    return {
      ring: "ring-warning/40",
      background: "from-warning/20",
      text: "text-warning",
      action: "bg-warning/10 text-warning",
    };
  }

  return {
    ring: "ring-success/30",
    background: "from-success/20",
    text: "text-success",
    action: "bg-success/10 text-success",
  };
}

function formatStatus(status: AnalysisStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function groupAnalysisFactors(reasons: string[], status: AnalysisStatus) {
  const fallback = getFallbackFactors(status);
  const grouped = (reasons.length > 0 ? reasons : fallback).reduce<Record<string, string[]>>((acc, rawReason) => {
    const [section, reason] = splitAnalysisReason(rawReason);
    acc[section] = [...(acc[section] ?? []), reason];
    return acc;
  }, {});

  return Object.entries(grouped).map(([title, items]) => ({
    title,
    items,
    ...getFactorTone(title, status),
  }));
}

function splitAnalysisReason(reason: string): [string, string] {
  const delimiter = reason.indexOf("|");
  if (delimiter === -1) {
    return ["Analysis Factors", reason];
  }

  const section = reason.slice(0, delimiter).trim() || "Analysis Factors";
  const text = reason.slice(delimiter + 1).trim() || reason;
  return [section, text];
}

function getFactorTone(title: string, status: AnalysisStatus) {
  if (title.toLowerCase().includes("protective")) {
    return { color: "text-success", dot: "bg-success" };
  }

  if (title.toLowerCase().includes("model")) {
    return { color: "text-primary", dot: "bg-primary" };
  }

  if (status === "fraud") {
    return { color: "text-destructive", dot: "bg-destructive" };
  }

  if (status === "review") {
    return { color: "text-warning", dot: "bg-warning" };
  }

  return { color: "text-success", dot: "bg-success" };
}

function getFallbackFactors(status: AnalysisStatus) {
  if (status === "fraud") {
    return [
      "Risk Factors|Final risk exceeded the fraud threshold.",
      "Risk Factors|Multiple fraud rules were triggered.",
      "Protective Factors|No protective factor was strong enough to offset the risk score.",
    ];
  }

  if (status === "review") {
    return [
      "Risk Factors|Transaction pattern requires additional verification.",
      "Risk Factors|Final risk exceeded the review threshold.",
      "Protective Factors|No confirmed fraud outcome has been assigned.",
    ];
  }

  return [
    "Protective Factors|No unusual transaction patterns were detected.",
    "Protective Factors|Final risk remained below the fraud threshold.",
  ];
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="glass rounded-lg p-2"><p className="text-[10px] text-muted-foreground">{label}</p><p className="font-semibold mt-0.5">{value}</p></div>;
}

function HistoryPanel({ loading, history, onSelectTransaction }: { loading: boolean; history: PredictionResult[]; onSelectTransaction: (id: number) => void }) {
  const transactionHistory = history.filter((item) => item.transactionId != null);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-display font-semibold">Prediction history</p>
        <History className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
          </div>
        ) : transactionHistory.length === 0 ? (
          <p className="text-sm text-muted-foreground">No transaction analyses yet.</p>
        ) : (
          transactionHistory.slice(0, 8).map((item) => <HistoryItem key={item.id} item={item} onSelectTransaction={onSelectTransaction} />)
        )}
      </div>
    </div>
  );
}

function HistoryItem({ item, onSelectTransaction }: { item: PredictionResult; onSelectTransaction: (id: number) => void }) {
  const transactionId = item.transactionId ?? 0;

  return (
    <button onClick={() => transactionId && onSelectTransaction(transactionId)} className="w-full text-left rounded-lg border border-border/50 bg-background/30 p-3 hover:bg-secondary/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{item.transactionMerchant ?? `Transaction #${transactionId}`}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(item.amount)} - {item.transactionStatus ?? (item.isFraud ? "fraud" : "safe")}</p>
        </div>
        <div className="text-right">
          <p className={item.isFraud ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-success"}>{item.riskScore}/100</p>
          <p className="text-xs text-muted-foreground">{item.riskLevel}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" /> {new Date(item.createdAt).toLocaleString()}
      </div>
    </button>
  );
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
