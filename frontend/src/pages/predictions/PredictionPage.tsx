import { Topbar } from "@/components/layout/Topbar";
import { predictionService } from "@/services/predictionService";
import type { PredictionInput, PredictionResult, TransactionType } from "@/types/prediction";
import {
  AlertTriangle,
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
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [history, setHistory] = useState<PredictionResult[]>([]);
  const [form, setForm] = useState<PredictionForm>(initialForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      setHistory(await predictionService.getMyHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load prediction history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const updateForm = (key: keyof PredictionForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const toRequest = (): PredictionInput | null => {
    const request = {
      transactionType: form.transactionType,
      amount: Number(form.amount),
      oldBalanceOrigin: Number(form.oldBalanceOrigin),
      newBalanceOrigin: Number(form.newBalanceOrigin),
      oldBalanceDestination: Number(form.oldBalanceDestination),
      newBalanceDestination: Number(form.newBalanceDestination),
    };

    const invalidField = Object.entries(request).find(([key, value]) => {
      return key !== "transactionType" && (!Number.isFinite(value) || Number(value) < 0);
    });

    if (invalidField) {
      setError("Enter valid non-negative numbers for every balance and amount field.");
      return null;
    }

    return request;
  };

  const run = async (event: FormEvent) => {
    event.preventDefault();
    const request = toRequest();
    if (!request) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const prediction = await predictionService.predict(request);
      setResult(prediction);
      setHistory((current) => [prediction, ...current.filter((item) => item.id !== prediction.id)]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run prediction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar title="AI Fraud Detection" subtitle="Score PaySim-style online payment transactions" />
      <main className="flex-1 p-4 md:p-8 grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-display font-semibold">Transaction details</h2>
              <p className="text-xs text-muted-foreground">Prediction is stored securely in your account history.</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={run}>
            <div className="grid md:grid-cols-2 gap-4">
              <Select
                label="Transaction Type"
                icon={WalletCards}
                value={form.transactionType}
                options={transactionTypes}
                onChange={(value: TransactionType) => updateForm("transactionType", value)}
              />
              <Input label="Amount" icon={CreditCard} value={form.amount} onChange={(value) => updateForm("amount", value)} />
              <Input label="Old Balance Origin" value={form.oldBalanceOrigin} onChange={(value) => updateForm("oldBalanceOrigin", value)} />
              <Input label="New Balance Origin" value={form.newBalanceOrigin} onChange={(value) => updateForm("newBalanceOrigin", value)} />
              <Input
                label="Old Balance Destination"
                value={form.oldBalanceDestination}
                onChange={(value) => updateForm("oldBalanceDestination", value)}
              />
              <Input
                label="New Balance Destination"
                value={form.newBalanceDestination}
                onChange={(value) => updateForm("newBalanceDestination", value)}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-6 w-full bg-gradient-primary text-primary-foreground rounded-lg py-3 font-medium ring-glow flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Scoring transaction...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" /> Run AI Prediction
                </>
              )}
            </button>
          </form>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <ResultPanel loading={loading} result={result} />
          <HistoryPanel loading={historyLoading} history={history} />
        </section>
      </main>
    </>
  );
}

function Input({
  label,
  icon: Icon,
  value,
  onChange,
}: {
  label: string;
  icon?: typeof CreditCard;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center glass rounded-lg px-3 py-2.5 focus-within:ring-1 focus-within:ring-primary/60">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground mr-2" />}
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="flex-1 bg-transparent text-sm outline-none"
        />
      </div>
    </label>
  );
}

function Select({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon?: typeof WalletCards;
  value: TransactionType;
  options: TransactionType[];
  onChange: (value: TransactionType) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center glass rounded-lg px-3 py-2.5">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground mr-2" />}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as TransactionType)}
          className="flex-1 bg-transparent text-sm outline-none appearance-none"
        >
          {options.map((option) => (
            <option key={option} value={option} className="bg-card">
              {option}
            </option>
          ))}
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
          <p className="mt-5 font-display font-semibold">Model processing...</p>
          <p className="text-xs text-muted-foreground">Calling the FraudGuard ML service</p>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="glass rounded-2xl p-8 text-center h-80 grid place-items-center">
        <div>
          <ShieldCheck className="h-10 w-10 mx-auto text-primary" />
          <p className="mt-3 font-display font-semibold">Ready to scan</p>
          <p className="text-xs text-muted-foreground">Fill out the form and run prediction</p>
        </div>
      </div>
    );
  }

  const fraud = result.isFraud;

  return (
    <div className={`glass rounded-2xl p-6 relative overflow-hidden ${fraud ? "ring-1 ring-destructive/50" : "ring-1 ring-success/30"}`}>
      <div className={`absolute inset-0 ${fraud ? "bg-gradient-to-br from-destructive/20 to-transparent" : "bg-gradient-to-br from-success/20 to-transparent"} pointer-events-none`} />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Prediction</p>
            <p className={`mt-1 text-2xl font-display font-semibold ${fraud ? "text-destructive" : "text-success"}`}>
              {fraud ? "Fraud detected" : "Transaction safe"}
            </p>
          </div>
          {fraud ? (
            <AlertTriangle className="h-8 w-8 text-destructive animate-pulse-glow" />
          ) : (
            <ShieldCheck className="h-8 w-8 text-success" />
          )}
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Risk score</span>
            <span>{result.riskScore}/100</span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full ${result.riskScore > 60 ? "bg-destructive" : result.riskScore > 30 ? "bg-warning" : "bg-success"}`}
              style={{ width: `${result.riskScore}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
            <Metric label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
            <Metric label="Risk level" value={result.riskLevel} />
            <Metric label="Fraud probability" value={`${Math.round(result.fraudProbability * 100)}%`} />
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Explanation</p>
          <ul className="space-y-2 text-sm">
            {result.reasons.map((reason) => (
              <li key={reason} className="flex gap-2">
                <span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${fraud ? "bg-destructive" : "bg-success"}`} /> {reason}
              </li>
            ))}
          </ul>
        </div>

        <div className={`mt-5 rounded-lg p-3 text-sm ${fraud ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
          <span className="font-semibold">Suggested action:</span> {result.suggestedAction}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function HistoryPanel({ loading, history }: { loading: boolean; history: PredictionResult[] }) {
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
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No predictions yet.</p>
        ) : (
          history.slice(0, 8).map((item) => <HistoryItem key={item.id} item={item} />)
        )}
      </div>
    </div>
  );
}

function HistoryItem({ item }: { item: PredictionResult }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{item.transactionType}</p>
          <p className="text-xs text-muted-foreground">{formatCurrency(item.amount)}</p>
        </div>
        <div className="text-right">
          <p className={item.isFraud ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-success"}>
            {item.riskScore}/100
          </p>
          <p className="text-xs text-muted-foreground">{item.riskLevel}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" /> {new Date(item.createdAt).toLocaleString()}
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
