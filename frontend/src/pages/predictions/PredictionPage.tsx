import { Topbar } from "@/components/layout/Topbar";
import { FraudSelect } from "@/components/common/FraudSelect";
import { ApiError } from "@/services/api";
import { predictionService } from "@/services/predictionService";
import { transactionService } from "@/services/transactionService";
import type {
  PredictionInput,
  PredictionResult,
  RiskBreakdownFactor,
  TransactionPredictionResult,
  TransactionType,
} from "@/types/prediction";
import type { Transaction } from "@/types/transaction";
import { formatCurrency } from "@/utils/formatters";
import {
  AlertTriangle,
  ChevronDown,
  Clock,
  Cpu,
  CreditCard,
  Download,
  History,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
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
type AdvancedValidationResult =
  | { request: PredictionInput; message: null }
  | { request: null; message: string };

const advancedNumberFields: Array<{
  key: Exclude<keyof PredictionForm, "transactionType">;
  label: string;
}> = [
  { key: "amount", label: "Amount" },
  { key: "oldBalanceOrigin", label: "Old Balance Origin" },
  { key: "newBalanceOrigin", label: "New Balance Origin" },
  { key: "oldBalanceDestination", label: "Old Balance Destination" },
  { key: "newBalanceDestination", label: "New Balance Destination" },
];

export default function Predict() {
  const [loading, setLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [exportingHistory, setExportingHistory] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [resultMode, setResultMode] = useState<"transaction" | "validation" | null>(null);
  const [history, setHistory] = useState<PredictionResult[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<PredictionResult | null>(null);
  const [form, setForm] = useState<PredictionForm>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    void loadHistory();
    void loadTransactions();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      setHistory(await predictionService.getMyHistory());
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : "Unable to load prediction history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadTransactions() {
    setTransactionsLoading(true);
    setTransactionsError(null);
    try {
      const rows = await transactionService.getTransactions();
      setTransactions(rows);
      setSelectedTransaction((current) =>
        current ? (rows.find((item) => item.id === current.id) ?? null) : null,
      );
    } catch (err) {
      setTransactionsError(err instanceof Error ? err.message : "Unable to load transactions.");
    } finally {
      setTransactionsLoading(false);
    }
  }

  async function exportHistory() {
    setExportingHistory(true);
    setError(null);

    try {
      const file = await predictionService.exportMyHistory();
      downloadBlob(file, `prediction-history-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Prediction history exported");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to export prediction history.";
      setError(message);
      toast.error(message);
    } finally {
      setExportingHistory(false);
    }
  }

  function selectTransaction(transactionId: string) {
    setSelectedTransaction(transactions.find((item) => item.id === Number(transactionId)) ?? null);
    setResult(null);
    setResultMode(null);
    setError(null);
  }

  async function analyzeSelectedTransaction() {
    if (!selectedTransaction) {
      setError("Choose a transaction first.");
      return;
    }

    setLoading(true);
    setResult(null);
    setResultMode(null);
    setError(null);

    try {
      const analysis = await predictionService.predictTransaction(selectedTransaction.id);
      const [refreshedTransaction, refreshedHistory] = await Promise.all([
        transactionService.getTransactionById(selectedTransaction.id),
        predictionService.getMyHistory(),
      ]);
      setSelectedTransaction(refreshedTransaction);
      setTransactions((current) =>
        current.map((item) => (item.id === refreshedTransaction.id ? refreshedTransaction : item)),
      );
      setHistory(refreshedHistory);
      setResult(buildAnalyzedTransactionResult(analysis, refreshedTransaction, refreshedHistory));
      setResultMode("transaction");
      toast.success("Transaction analysis completed");
    } catch (err) {
      const message = formatPredictionError(err, "Unable to analyze transaction.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  const updateForm = (key: keyof PredictionForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const runAdvancedPrediction = async (event: FormEvent) => {
    event.preventDefault();
    const validation = validateAdvancedRequest(form);
    if (!validation.request) {
      setError(validation.message);
      return;
    }

    setLoading(true);
    setResult(null);
    setResultMode(null);
    setError(null);

    try {
      const prediction = await predictionService.advancedTest(validation.request);
      setResult(prediction);
      setResultMode("validation");
      toast.success("Advanced validation completed");
    } catch (err) {
      const message = formatPredictionError(err, "Unable to run advanced model test.");
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Topbar
        title="Fraud Analysis"
        subtitle="Analyze saved transactions and monitor risk decisions"
      />
      <main className="grid min-w-0 flex-1 gap-6 overflow-x-hidden p-4 md:p-8 lg:grid-cols-5">
        <section className="lg:col-span-3 space-y-5">
          <div className="glass rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <h2 className="font-display font-semibold">Select Transaction</h2>
                <p className="text-xs text-muted-foreground">
                  Choose a saved transaction, then run a fresh analysis.
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <TransactionPicker
              loading={transactionsLoading}
              error={transactionsError}
              transactions={transactions}
              selectedId={selectedTransaction?.id ?? ""}
              onChange={selectTransaction}
              onRetry={() => void loadTransactions()}
            />

            <div className="mt-5">
              {transactionsLoading ? (
                <NeutralState
                  title="Loading saved transactions"
                  message="Fetching your transaction list from FraudGuard."
                  spin
                />
              ) : transactionsError ? (
                <NeutralState title="Unable to load transactions" message={transactionsError} />
              ) : transactions.length === 0 ? (
                <EmptyTransactionsState />
              ) : selectedTransaction ? (
                <TransactionSummaryCard transaction={selectedTransaction} />
              ) : (
                <NeutralState
                  title="No transaction selected"
                  message="Pick a saved transaction to preview neutral details. Risk status appears only after analysis."
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => void analyzeSelectedTransaction()}
              disabled={!selectedTransaction || loading || transactionsLoading}
              className="mt-6 w-full bg-gradient-primary text-primary-foreground rounded-lg py-3 font-medium ring-glow flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Analyzing transaction...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" /> Analyze Transaction
                </>
              )}
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
                <p className="text-xs text-muted-foreground">
                  Model validation only. Results are not saved to prediction history.
                </p>
              </div>
              <ChevronDown className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`} />
            </button>
            {advancedOpen && (
              <form onSubmit={runAdvancedPrediction} className="mt-5">
                <div className="grid md:grid-cols-2 gap-4">
                  <Select
                    label="Transaction Type"
                    icon={WalletCards}
                    value={form.transactionType}
                    options={transactionTypes}
                    onChange={(value) => updateForm("transactionType", value)}
                  />
                  <Input
                    label="Amount"
                    icon={CreditCard}
                    value={form.amount}
                    onChange={(value) => updateForm("amount", value)}
                  />
                  <Input
                    label="Old Balance Origin"
                    value={form.oldBalanceOrigin}
                    onChange={(value) => updateForm("oldBalanceOrigin", value)}
                  />
                  <Input
                    label="New Balance Origin"
                    value={form.newBalanceOrigin}
                    onChange={(value) => updateForm("newBalanceOrigin", value)}
                  />
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
                  className="mt-6 w-full glass rounded-lg py-3 text-sm hover:ring-1 hover:ring-primary/40 disabled:opacity-60"
                >
                  {loading ? "Running validation..." : "Run Advanced Model Test"}
                </button>
              </form>
            )}
          </div>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <ResultPanel
            loading={loading}
            result={result}
            mode={resultMode}
            selectedTransaction={selectedTransaction}
          />
          <HistoryPanel
            loading={historyLoading}
            error={historyError}
            history={history}
            exporting={exportingHistory}
            onExport={() => void exportHistory()}
            onRefresh={() => void loadHistory()}
            onSelect={(item) => {
              setSelectedHistoryItem(item);
            }}
          />
        </section>
      </main>
      {selectedHistoryItem && (
        <PredictionDetailsModal
          prediction={selectedHistoryItem}
          onClose={() => setSelectedHistoryItem(null)}
        />
      )}
    </>
  );
}

function formatPredictionError(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.status === 404) {
    return "Advanced model testing is not available from the current API. Confirm the backend includes /api/predictions/advanced-test.";
  }

  if (error instanceof ApiError && error.status === 503) {
    return error.message || "Prediction service is unavailable. Please start the ML service and try again.";
  }

  return error instanceof Error ? error.message : fallback;
}

function downloadBlob(file: Blob, fileName: string) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function validateAdvancedRequest(form: PredictionForm): AdvancedValidationResult {
  if (!transactionTypes.includes(form.transactionType)) {
    return { request: null, message: "Choose a valid transaction type." };
  }

  const values = {} as Record<Exclude<keyof PredictionForm, "transactionType">, number>;
  for (const field of advancedNumberFields) {
    const rawValue = form[field.key].trim();
    if (rawValue.length === 0) {
      return { request: null, message: `${field.label} is required.` };
    }

    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      return { request: null, message: `${field.label} must be a numeric value.` };
    }

    if (value < 0) {
      return { request: null, message: `${field.label} cannot be negative.` };
    }

    values[field.key] = value;
  }

  return {
    request: {
      transactionType: form.transactionType,
      amount: values.amount,
      oldBalanceOrigin: values.oldBalanceOrigin,
      newBalanceOrigin: values.newBalanceOrigin,
      oldBalanceDestination: values.oldBalanceDestination,
      newBalanceDestination: values.newBalanceDestination,
    },
    message: null,
  };
}

function buildAnalyzedTransactionResult(
  analysis: TransactionPredictionResult,
  transaction: Transaction,
  history: PredictionResult[],
): PredictionResult {
  const saved = history.find((item) => item.id === analysis.predictionId);

  return {
    id: analysis.predictionId,
    userId: transaction.userId,
    transactionId: transaction.id,
    transactionMerchant: transaction.merchant,
    transactionCountry: transaction.country,
    transactionCategory: transaction.category,
    transactionCurrency: transaction.currency,
    transactionCreatedAt: transaction.createdAt,
    transactionStatus: analysis.status,
    transactionType: normalizeTransactionType(transaction.transactionType),
    amount: transaction.amount,
    oldBalanceOrigin: transaction.amount,
    newBalanceOrigin: 0,
    oldBalanceDestination: 0,
    newBalanceDestination: transaction.amount,
    fraudProbability: analysis.riskScore / 100,
    riskScore: analysis.riskScore,
    riskLevel: analysis.riskLevel,
    isFraud: analysis.status === "fraud",
    predictedClass: analysis.predictedClass,
    confidence: analysis.confidence,
    reasons: analysis.explanation,
    explanationFactors: analysis.explanation,
    riskBreakdown: saved?.riskBreakdown,
    modelName: analysis.modelName,
    modelTrainingDate: analysis.modelTrainingDate,
    suggestedAction: saved?.suggestedAction ?? suggestedActionForScore(analysis.riskScore),
    createdAt: analysis.createdAt,
  };
}

function normalizeTransactionType(value: string): TransactionType {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  return transactionTypes.includes(normalized as TransactionType)
    ? (normalized as TransactionType)
    : "PAYMENT";
}

function suggestedActionForScore(score: number) {
  return score >= 70
    ? "Block transaction immediately"
    : score >= 40
      ? "Manual verification recommended"
      : "Approve transaction";
}

function TransactionPicker({
  loading,
  error,
  transactions,
  selectedId,
  onChange,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  transactions: Transaction[];
  selectedId: number | "";
  onChange: (transactionId: string) => void;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-3">
        <label className="block flex-1">
          <span className="text-xs text-muted-foreground">Choose existing transaction</span>
          <div className="mt-1">
            <FraudSelect
              value={selectedId}
              onValueChange={onChange}
              disabled={loading || Boolean(error) || transactions.length === 0}
              placeholder={loading ? "Loading transactions..." : "Select transaction"}
              ariaLabel="Select transaction"
              triggerClassName="min-h-12 w-full px-3 py-3 text-sm"
              contentClassName="max-h-80"
              options={transactions.map((transaction) => {
                const label = formatTransactionOption(transaction);
                return { value: transaction.id, label, title: label };
              })}
            />
          </div>
        </label>
        {error && (
          <button
            type="button"
            onClick={onRetry}
            className="mb-0.5 h-11 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            Retry
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Saved risk values are hidden here until you run a new analysis.
      </p>
    </div>
  );
}

function formatTransactionOption(transaction: Transaction) {
  return [
    transaction.merchant,
    formatCurrency(transaction.amount, transaction.currency),
    transaction.transactionType,
    transaction.category,
    transaction.country,
    formatDate(transaction.createdAt),
  ].join(" - ");
}

function NeutralState({
  title,
  message,
  spin = false,
}: {
  title: string;
  message: string;
  spin?: boolean;
}) {
  return (
    <div className="glass rounded-xl p-8 text-center text-sm text-muted-foreground">
      {spin && <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-primary" />}
      <p className="font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5">{message}</p>
    </div>
  );
}

function EmptyTransactionsState() {
  return (
    <div className="glass rounded-xl p-8 text-center">
      <CreditCard className="mx-auto h-8 w-8 text-primary" />
      <p className="mt-3 font-display font-semibold">No saved transactions yet</p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">
        Add a transaction first, then return here to run a fraud analysis on real saved data.
      </p>
    </div>
  );
}

function TransactionSummaryCard({ transaction }: { transaction: Transaction }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Selected transaction</p>
          <p className="font-display text-lg font-semibold">{transaction.merchant}</p>
        </div>
        <span className="rounded-md bg-primary/10 px-2 py-1 text-[10px] uppercase tracking-wider text-primary">
          Ready for analysis
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <SummaryMetric label="Merchant" value={transaction.merchant} />
        <SummaryMetric label="Category" value={transaction.category} />
        <SummaryMetric label="Country" value={transaction.country} />
        <SummaryMetric
          label="Amount"
          value={formatCurrency(transaction.amount, transaction.currency)}
        />
        <SummaryMetric label="Currency" value={transaction.currency} />
        <SummaryMetric label="Transaction Type" value={transaction.transactionType} />
        <SummaryMetric label="Created" value={formatDateTime(transaction.createdAt)} />
        <SummaryMetric
          label="Description"
          value={transaction.description ?? "No description provided"}
        />
      </div>
      <p className="mt-4 rounded-lg border border-border/50 bg-background/30 p-3 text-xs leading-5 text-muted-foreground">
        This preview intentionally excludes previous risk scores and decisions. Click Analyze
        Transaction to generate a new result.
      </p>
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
          required
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
      <div className="mt-1 flex items-center gap-2 glass rounded-lg px-3 py-2.5">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground mr-2" />}
        <FraudSelect
          value={value}
          onValueChange={(nextValue) => onChange(nextValue as TransactionType)}
          options={options.map((option) => ({ value: option, label: option }))}
          ariaLabel={label}
          triggerClassName="h-8 min-h-8 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none hover:border-0 hover:bg-transparent focus:ring-0"
          contentClassName="z-[110]"
        />
      </div>
    </label>
  );
}

function ResultPanel({
  loading,
  result,
  mode,
  selectedTransaction,
}: {
  loading: boolean;
  result: PredictionResult | null;
  mode: "transaction" | "validation" | null;
  selectedTransaction: Transaction | null;
}) {
  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 text-center relative overflow-hidden h-80 grid place-items-center">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
        <div>
          <div className="mx-auto h-20 w-20 rounded-full bg-gradient-primary grid place-items-center animate-pulse-glow">
            <Cpu className="h-8 w-8 text-primary-foreground" />
          </div>
          <p className="mt-5 font-display font-semibold">Analyzing transaction...</p>
          <p className="text-xs text-muted-foreground">
            Scoring transaction data with the active fraud model.
          </p>
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
          <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
            Select a saved transaction and click Analyze Transaction. Scores, risk levels, and
            decisions stay hidden until the API returns a result.
          </p>
        </div>
      </div>
    );
  }

  const status = getPredictionStatus(result);
  const tone = getStatusTone(status);
  const factorGroups = groupAnalysisFactors(getExplanationFactors(result), status);

  return (
    <div className={`glass rounded-2xl p-6 relative overflow-hidden ring-1 ${tone.ring}`}>
      <div
        className={`absolute inset-0 bg-gradient-to-br ${tone.background} to-transparent pointer-events-none`}
      />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {mode === "validation" ? "Model Validation Result" : "Analysis Result"}
            </p>
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
            <div
              className={`h-full rounded-full ${result.riskScore >= 70 ? "bg-destructive" : result.riskScore >= 40 ? "bg-warning" : "bg-success"}`}
              style={{ width: `${result.riskScore}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-4 text-center text-xs">
            <Metric label="Probability" value={`${Math.round(result.fraudProbability * 100)}%`} />
            <Metric label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
            <Metric
              label="Prediction"
              value={result.predictedClass ?? (result.isFraud ? "Fraud" : "Not fraud")}
            />
            <Metric label="Risk level" value={result.riskLevel} />
            {result.modelName && <Metric label="Model" value={result.modelName} />}
            {result.modelTrainingDate && (
              <Metric label="Trained" value={formatDateTime(result.modelTrainingDate)} />
            )}
          </div>
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Analyzed Transaction Details
          </p>
          <DetailGrid
            items={[
              [
                "Transaction",
                result.transactionId
                  ? `TX-${result.transactionId}`
                  : mode === "validation"
                    ? "Validation input"
                    : "Saved transaction",
              ],
              [
                "Merchant",
                result.transactionMerchant ?? selectedTransaction?.merchant ?? "Validation input",
              ],
              [
                "Amount",
                formatCurrency(
                  result.amount,
                  result.transactionCurrency ?? selectedTransaction?.currency ?? "EUR",
                ),
              ],
              ["Type", result.transactionType],
              [
                "Country",
                result.transactionCountry ?? selectedTransaction?.country ?? "Not linked",
              ],
              ["Analyzed", formatDateTime(result.createdAt)],
            ]}
          />
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Transaction Risk Breakdown
          </p>
          <RiskBreakdownList factors={getRiskBreakdown(result)} />
        </div>
        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Supporting Signals
          </p>
          <div className="space-y-4">
            {factorGroups.map((group) => (
              <div key={group.title}>
                <p
                  className={`mb-2 text-xs font-semibold uppercase tracking-widest ${group.color}`}
                >
                  {group.title}
                </p>
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

  const riskLevel = result.riskLevel?.toLowerCase();
  const predictedClass = result.predictedClass?.toLowerCase();

  if (result.riskScore >= 70 || result.isFraud || riskLevel === "high" || predictedClass === "fraud") {
    return "fraud";
  }

  if (
    result.riskScore >= 40 ||
    riskLevel === "medium" ||
    predictedClass === "review" ||
    predictedClass === "needs review"
  ) {
    return "review";
  }

  return "safe";
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
  if (status === "fraud") {
    return "High Risk";
  }

  if (status === "review") {
    return "Needs Review";
  }

  return "Safe";
}

function groupAnalysisFactors(reasons: string[], status: AnalysisStatus) {
  const fallback = getFallbackFactors(status);
  const grouped = (reasons.length > 0 ? reasons : fallback).reduce<Record<string, string[]>>(
    (acc, rawReason) => {
      const [section, reason] = splitAnalysisReason(rawReason);
      acc[section] = [...(acc[section] ?? []), reason];
      return acc;
    },
    {},
  );

  return Object.entries(grouped).map(([title, items]) => ({
    title,
    items,
    ...getFactorTone(title, status),
  }));
}

function getExplanationFactors(prediction: PredictionResult) {
  return prediction.explanationFactors?.length ? prediction.explanationFactors : prediction.reasons;
}

function getRiskBreakdown(prediction: PredictionResult) {
  return prediction.riskBreakdown?.length
    ? prediction.riskBreakdown
    : buildLocalRiskBreakdown(prediction);
}

function buildLocalRiskBreakdown(prediction: PredictionInput): RiskBreakdownFactor[] {
  const amount = prediction.amount;
  const originDelta = prediction.oldBalanceOrigin - prediction.newBalanceOrigin;
  const destinationDelta = prediction.newBalanceDestination - prediction.oldBalanceDestination;
  const sensitiveType =
    prediction.transactionType === "TRANSFER" || prediction.transactionType === "CASH_OUT";

  return [
    {
      factor: amount >= 100_000 ? "High transaction amount" : "Transaction amount",
      impact: amount >= 1_000_000 ? "High risk" : amount >= 100_000 ? "Risk" : "Neutral",
      explanation:
        amount >= 1_000_000
          ? `Amount is ${formatCurrency(amount)}, above the very-high-value threshold.`
          : amount >= 100_000
            ? `Amount is ${formatCurrency(amount)}, above the high-value threshold.`
            : `Amount is ${formatCurrency(amount)}, below the high-value threshold.`,
    },
    {
      factor: "Transfer or cash-out transaction type",
      impact: sensitiveType ? "Risk" : "Protective",
      explanation: sensitiveType
        ? `${prediction.transactionType} is treated as fraud-sensitive because money leaves or moves between accounts.`
        : `${prediction.transactionType} is not one of the higher-risk transfer or cash-out types.`,
    },
    {
      factor: "Origin account balance drop",
      impact:
        originDelta <= 0 && amount > 0
          ? "Risk"
          : amount > 0 && Math.abs(originDelta - amount) > amount * 0.25
            ? "Risk"
            : "Protective",
      explanation:
        originDelta <= 0 && amount > 0
          ? "Origin balance did not decrease even though the transaction amount is positive."
          : amount > 0 && Math.abs(originDelta - amount) > amount * 0.25
            ? `Origin balance dropped by ${formatCurrency(originDelta)}, which differs from the amount by more than 25%.`
            : `Origin balance dropped by ${formatCurrency(originDelta)}, broadly matching the amount.`,
    },
    {
      factor: "Destination account balance behavior",
      impact:
        destinationDelta < 0 ||
        (amount > 0 && destinationDelta === 0) ||
        (prediction.oldBalanceDestination === 0 && amount >= 100_000)
          ? "Risk"
          : "Protective",
      explanation:
        destinationDelta < 0
          ? "Destination balance decreased during a transaction that should move funds in."
          : amount > 0 && destinationDelta === 0
            ? "Destination balance did not change despite a positive transaction amount."
            : prediction.oldBalanceDestination === 0 && amount >= 100_000
              ? "Destination started at zero and received a high-value amount."
              : `Destination balance changed by ${formatCurrency(destinationDelta)}, consistent with receiving funds.`,
    },
    {
      factor: "Zero balance after transaction",
      impact:
        prediction.newBalanceOrigin === 0 || prediction.newBalanceDestination === 0
          ? "Risk"
          : "Protective",
      explanation:
        prediction.newBalanceOrigin === 0 || prediction.newBalanceDestination === 0
          ? "At least one account has a zero balance after the transaction."
          : "Neither account has a zero balance after the transaction.",
    },
  ];
}

function RiskBreakdownList({ factors }: { factors: RiskBreakdownFactor[] }) {
  return (
    <div className="space-y-2">
      {factors.map((factor) => {
        const tone = getBreakdownTone(factor.impact);
        return (
          <div
            key={factor.factor}
            className="rounded-lg border border-border/50 bg-background/30 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold">{factor.factor}</p>
              <span
                className={`shrink-0 rounded-md px-2 py-1 text-[10px] uppercase tracking-wider ${tone.badge}`}
              >
                {factor.impact}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{factor.explanation}</p>
          </div>
        );
      })}
    </div>
  );
}

function getBreakdownTone(impact: string) {
  const normalized = impact.toLowerCase();
  if (normalized.includes("risk")) {
    return { badge: "bg-destructive/15 text-destructive" };
  }

  if (normalized.includes("protective")) {
    return { badge: "bg-success/15 text-success" };
  }

  return { badge: "bg-secondary text-muted-foreground" };
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
  return [
    `Explanation Factors|No explanation factors were returned for this ${status} prediction.`,
  ];
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function HistoryPanel({
  loading,
  error,
  history,
  exporting,
  onExport,
  onRefresh,
  onSelect,
}: {
  loading: boolean;
  error: string | null;
  history: PredictionResult[];
  exporting: boolean;
  onExport: () => void;
  onRefresh: () => void;
  onSelect: (item: PredictionResult) => void;
}) {
  return (
    <div className="glass flex min-h-0 flex-col overflow-hidden rounded-2xl p-5">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-display font-semibold">Prediction history</p>
          <p className="text-[11px] text-muted-foreground">Analyzed results only</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh prediction history"
            className="h-8 w-8 grid place-items-center rounded-lg glass hover:ring-1 hover:ring-primary/40 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={loading || exporting || history.length === 0}
            title="Export prediction history"
            className="h-8 w-8 grid place-items-center rounded-lg glass hover:ring-1 hover:ring-primary/40 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      <div className="scrollbar-thin mt-4 max-h-[360px] space-y-3 overflow-y-auto overflow-x-hidden pr-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading history...
          </div>
        ) : error ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-lg border border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
            <History className="mb-3 h-5 w-5 text-primary" />
            <p className="font-medium text-foreground">No analyzed predictions yet</p>
            <p className="mt-1 text-xs leading-5">
              Run Analyze Transaction to create the first saved prediction result.
            </p>
          </div>
        ) : (
          history
            .slice(0, 8)
            .map((item) => <HistoryItem key={item.id} item={item} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

function HistoryItem({
  item,
  onSelect,
}: {
  item: PredictionResult;
  onSelect: (item: PredictionResult) => void;
}) {
  const title =
    item.transactionMerchant ??
    (item.transactionId ? `Transaction #${item.transactionId}` : "Manual prediction");
  const status = item.transactionStatus ?? getPredictionStatus(item);

  return (
    <button
      onClick={() => onSelect(item)}
      className="w-full min-w-0 text-left rounded-lg border border-border/50 bg-background/30 p-3 hover:bg-secondary/30"
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" title={title}>{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatCurrency(item.amount, item.transactionCurrency ?? "EUR")} -{" "}
            {formatStatus(status)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={
              item.isFraud
                ? "text-sm font-semibold text-destructive"
                : "text-sm font-semibold text-success"
            }
          >
            {item.riskScore}/100
          </p>
          <p className="text-xs text-muted-foreground">{item.riskLevel}</p>
        </div>
      </div>
      <div className="mt-2 flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground">
        <Clock className="h-3 w-3" /> {new Date(item.createdAt).toLocaleString()}
      </div>
    </button>
  );
}

function PredictionDetailsModal({
  prediction,
  onClose,
}: {
  prediction: PredictionResult;
  onClose: () => void;
}) {
  const status = getPredictionStatus(prediction);
  const tone = getStatusTone(status);
  const factorGroups = groupAnalysisFactors(getExplanationFactors(prediction), status);
  const alertGenerated = status === "review" || status === "fraud";
  const title =
    prediction.transactionMerchant ??
    (prediction.transactionId ? `Transaction #${prediction.transactionId}` : "Manual prediction");

  return (
    <div className="scrollbar-thin fixed inset-0 z-50 overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="glass mx-auto my-6 w-full max-w-4xl rounded-2xl ring-1 ring-border"
      >
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Prediction details
            </p>
            <h2 className="font-display text-xl font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close details"
            className="h-9 w-9 grid place-items-center rounded-lg glass hover:ring-1 hover:ring-primary/40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 p-5">
          <DetailSection title="Input Transaction Values">
            <DetailGrid
              items={[
                [
                  "Transaction ID",
                  prediction.transactionId ? `TX-${prediction.transactionId}` : "Manual prediction",
                ],
                ["Transaction Type", prediction.transactionType],
                [
                  "Amount",
                  formatCurrency(prediction.amount, prediction.transactionCurrency ?? "EUR"),
                ],
                [
                  "Old Origin Balance",
                  formatCurrency(
                    prediction.oldBalanceOrigin,
                    prediction.transactionCurrency ?? "EUR",
                  ),
                ],
                [
                  "New Origin Balance",
                  formatCurrency(
                    prediction.newBalanceOrigin,
                    prediction.transactionCurrency ?? "EUR",
                  ),
                ],
                [
                  "Old Destination Balance",
                  formatCurrency(
                    prediction.oldBalanceDestination,
                    prediction.transactionCurrency ?? "EUR",
                  ),
                ],
                [
                  "New Destination Balance",
                  formatCurrency(
                    prediction.newBalanceDestination,
                    prediction.transactionCurrency ?? "EUR",
                  ),
                ],
              ]}
            />
          </DetailSection>

          <DetailSection title="Stored Context">
            <DetailGrid
              items={[
                ["Merchant", prediction.transactionMerchant ?? "Manual prediction"],
                ["Country", prediction.transactionCountry ?? "Not linked"],
                ["Category", prediction.transactionCategory ?? "Not linked"],
                ["Currency", prediction.transactionCurrency ?? "EUR"],
                [
                  "Transaction Date",
                  formatDateTime(prediction.transactionCreatedAt ?? prediction.createdAt),
                ],
                ["Created", formatDateTime(prediction.createdAt)],
              ]}
            />
          </DetailSection>

          <DetailSection title="Prediction Result">
            <div className={`rounded-xl border p-4 ${tone.ring}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-2xl font-display font-semibold ${tone.text}`}>
                    {prediction.riskScore}/100
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {prediction.riskLevel} risk · {formatStatus(status)}
                  </p>
                </div>
                {status === "fraud" ? (
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                ) : (
                  <ShieldCheck className={`h-8 w-8 ${tone.text}`} />
                )}
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full ${status === "fraud" ? "bg-destructive" : status === "review" ? "bg-warning" : "bg-success"}`}
                  style={{ width: `${Math.max(3, prediction.riskScore)}%` }}
                />
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                <Metric
                  label="Fraud probability"
                  value={`${Math.round(prediction.fraudProbability * 100)}%`}
                />
                <Metric label="Confidence" value={`${Math.round(prediction.confidence * 100)}%`} />
                <Metric
                  label="Prediction label"
                  value={prediction.predictedClass ?? (prediction.isFraud ? "Fraud" : "Not fraud")}
                />
                {prediction.modelName && <Metric label="Model used" value={prediction.modelName} />}
                {prediction.modelTrainingDate && (
                  <Metric
                    label="Training date"
                    value={formatDateTime(prediction.modelTrainingDate)}
                  />
                )}
              </div>
            </div>
          </DetailSection>

          <DetailSection title="Transaction Risk Breakdown">
            <RiskBreakdownList factors={getRiskBreakdown(prediction)} />
          </DetailSection>

          <DetailSection title="Supporting Signals">
            <div className="space-y-4">
              {factorGroups.map((group) => (
                <div key={group.title}>
                  <p
                    className={`mb-2 text-xs font-semibold uppercase tracking-widest ${group.color}`}
                  >
                    {group.title}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {group.items.map((item) => (
                      <li key={`${group.title}-${item}`} className="flex gap-2">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${group.dot}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </DetailSection>

          <div className="space-y-5">
            <DetailSection title="Model Decision Summary">
              <p className="text-sm leading-6 text-muted-foreground">
                {buildDecisionSummary(prediction, status)}
              </p>
              <p className={`mt-3 rounded-lg p-3 text-sm ${tone.action}`}>
                <strong>Recommended action:</strong> {prediction.suggestedAction}
              </p>
            </DetailSection>

            <DetailSection title="Timeline">
              <TimelineItem
                label="Prediction Created"
                value={formatDateTime(prediction.createdAt)}
                complete
              />
              <TimelineItem
                label="Prediction Evaluated"
                value={`Risk score ${prediction.riskScore}/100 assigned`}
                complete
              />
              <TimelineItem
                label="Alert Generated"
                value={
                  alertGenerated
                    ? "Risk result created an alert for review."
                    : "No alert required for this result."
                }
                complete={alertGenerated}
              />
            </DetailSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/50 bg-background/25 p-4">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailGrid({ items }: { items: [string, string][] }) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg bg-background/30 p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 break-words text-sm font-medium">{value}</p>
        </div>
      ))}
    </div>
  );
}

function TimelineItem({
  label,
  value,
  complete,
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="flex gap-3 pb-4 last:pb-0">
      <span
        className={`mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ${complete ? "bg-success ring-success/15" : "bg-muted-foreground ring-secondary"}`}
      />
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

function buildDecisionSummary(prediction: PredictionResult, status: AnalysisStatus) {
  const classification =
    status === "fraud" ? "HIGH RISK" : status === "review" ? "MEDIUM RISK" : "LOW RISK";
  const threshold =
    status === "fraud"
      ? "exceeded the fraud threshold"
      : status === "review"
        ? "exceeded the review threshold"
        : "remained below the review threshold";
  return `Transaction was classified as ${classification} based on the evaluated transaction factors. The final score reached ${prediction.riskScore}/100 and ${threshold}.`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
