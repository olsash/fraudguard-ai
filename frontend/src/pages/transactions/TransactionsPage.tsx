import { Topbar } from "@/components/layout/Topbar";
import { predictionService } from "@/services/predictionService";
import { transactionService } from "@/services/transactionService";
import type { CreateTransactionInput, Transaction, TransactionFilters, TransactionStatus } from "@/types/transaction";
import { ChevronRight, Download, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const initialForm = {
  merchant: "",
  category: "",
  country: "",
  amount: "",
  currency: "USD",
  transactionType: "PAYMENT",
  description: "",
};

type TransactionForm = typeof initialForm;
const categories = [
  "Retail", "E-Commerce", "Money Transfer", "Bank Transfer", "Crypto", "Gambling", "Travel", "Food & Dining",
  "Entertainment", "Healthcare", "Education", "Utilities", "Insurance", "Investment", "Subscription",
  "Telecommunications", "Government", "ATM Withdrawal", "Cash Deposit", "Cash Withdrawal", "Other",
];
const countries = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica",
  "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia", "Democratic Republic of the Congo", "Denmark", "Djibouti", "Dominica",
  "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland",
  "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia",
  "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia",
  "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco",
  "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand",
  "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama",
  "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands",
  "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland",
  "Syria", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey",
  "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay",
  "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
];

export default function TxPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summaryText, setSummaryText] = useState("0 transactions");
  const [filters, setFilters] = useState<TransactionFilters>({ status: "all" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<TransactionForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [predictingId, setPredictingId] = useState<number | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadTransactions(), 250);
    return () => window.clearTimeout(timeout);
  }, [filters.search, filters.status, filters.fromDate, filters.toDate]);

  async function loadTransactions() {
    setLoading(true);
    setError(null);

    try {
      const rows = await transactionService.getTransactions(filters);
      setTransactions(rows);
      setSummaryText(`${rows.length} transaction${rows.length === 1 ? "" : "s"}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load transactions. Check that the backend API is running.");
    } finally {
      setLoading(false);
    }
  }

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    const payload: CreateTransactionInput = {
      merchant: form.merchant,
      category: form.category,
      country: form.country,
      amount,
      currency: form.currency || "USD",
      transactionType: form.transactionType,
      description: form.description || null,
    };

    setSaving(true);
    setError(null);

    try {
      await transactionService.createTransaction(payload);
      toast.success("Transaction created. Click Predict to analyze fraud risk.");
      setShowCreate(false);
      setForm(initialForm);
      await loadTransactions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create transaction.");
    } finally {
      setSaving(false);
      setPredictingId(null);
    }
  }

  async function predictTransaction(transactionId: number) {
    setPredictingId(transactionId);
    setError(null);

    try {
      await predictionService.predictTransaction(transactionId);
      toast.success("Prediction saved successfully");
      await loadTransactions();
      if (selected?.id === transactionId) {
        setSelected(await transactionService.getTransactionById(transactionId));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to run prediction.");
    } finally {
      setPredictingId(null);
    }
  }

  function exportCsv() {
    const header = ["Id", "Merchant", "Category", "Country", "Amount", "Currency", "RiskScore", "Status", "TransactionType", "CreatedAt"];
    const rows = transactions.map((transaction) => [
      transaction.id,
      transaction.merchant,
      transaction.category,
      transaction.country,
      transaction.amount,
      transaction.currency,
      transaction.riskScore,
      transaction.status,
      transaction.transactionType,
      transaction.createdAt,
    ]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "fraudguard-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <Topbar title="Transactions" subtitle={summaryText} />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <Toolbar filters={filters} onChange={setFilters} onCreate={() => setShowCreate(true)} onExport={exportCsv} />

        {loading && <StatePanel title="Loading transactions" message="Fetching transactions from FraudGuard API." />}
        {!loading && error && <StatePanel title="Transactions unavailable" message={error} destructive />}
        {!loading && !error && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <Th>ID</Th><Th>Merchant</Th><Th>Category</Th><Th>Country</Th><Th>Amount</Th><Th>Risk</Th><Th>Status</Th><Th>Time</Th><Th />
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr className="border-t border-border">
                      <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No transactions found</td>
                    </tr>
                  ) : transactions.map((transaction) => (
                    <tr key={transaction.id} onClick={() => setSelected(transaction)} className="border-t border-border hover:bg-secondary/40 cursor-pointer">
                      <Td><span className="font-mono text-xs">TX-{transaction.id}</span></Td>
                      <Td><div className="flex items-center gap-2"><div className="h-7 w-7 rounded-md bg-gradient-primary grid place-items-center text-[10px] font-semibold text-primary-foreground">{transaction.merchant[0] ?? "T"}</div>{transaction.merchant}</div></Td>
                      <Td>{transaction.category}</Td>
                      <Td>{transaction.country}</Td>
                      <Td className="font-mono font-semibold">{formatCurrency(transaction.amount, transaction.currency)}</Td>
                      <Td><RiskBar value={transaction.riskScore} /></Td>
                      <Td><StatusBadge s={transaction.status} /></Td>
                      <Td className="text-xs text-muted-foreground">{formatDateTime(transaction.createdAt)}</Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void predictTransaction(transaction.id);
                            }}
                            disabled={predictingId === transaction.id}
                            className="rounded px-2 py-1 text-xs glass hover:ring-1 hover:ring-primary/40 disabled:opacity-60"
                          >
                            {predictingId === transaction.id ? "Scoring..." : transaction.latestPredictionId ? "Re-analyze" : "Run Analysis"}
                          </button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      {selected && <TxModal tx={selected} predicting={predictingId === selected.id} onPredict={() => void predictTransaction(selected.id)} onClose={() => setSelected(null)} />}
      {showCreate && (
        <CreateTransactionModal
          form={form}
          saving={saving}
          onChange={setForm}
          onClose={() => setShowCreate(false)}
          onSubmit={createTransaction}
        />
      )}
    </>
  );
}

function Toolbar({ filters, onChange, onCreate, onExport }: { filters: TransactionFilters; onChange: (filters: TransactionFilters) => void; onCreate: () => void; onExport: () => void }) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 glass rounded-lg px-3 py-2 flex-1 min-w-[240px]">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={filters.search ?? ""} onChange={(e) => onChange({ ...filters, search: e.target.value })} placeholder="Search merchant, category, country..." className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      <div className="flex items-center gap-1">
        {["all", "pending", "safe", "review", "fraud"].map((status) => (
          <button key={status} onClick={() => onChange({ ...filters, status: status as TransactionFilters["status"] })}
            className={`text-xs px-3 py-1.5 rounded-lg capitalize ${filters.status === status ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}>
            {status}
          </button>
        ))}
      </div>
      <input type="date" value={filters.fromDate ?? ""} onChange={(e) => onChange({ ...filters, fromDate: e.target.value || undefined })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <input type="date" value={filters.toDate ?? ""} onChange={(e) => onChange({ ...filters, toDate: e.target.value || undefined })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <button onClick={onExport} className="glass rounded-lg px-3 py-2 text-sm flex items-center gap-2 hover:ring-1 hover:ring-primary/40"><Download className="h-4 w-4" /> Export</button>
      <button onClick={onCreate} className="bg-gradient-primary text-primary-foreground rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Plus className="h-4 w-4" /> Add Transaction</button>
    </div>
  );
}

export function Th({ children }: { children?: React.ReactNode }) { return <th className="text-left font-medium px-4 py-3">{children}</th>; }
export function Td({ children, className = "" }: any) { return <td className={`px-4 py-3 ${className}`}>{children}</td>; }

export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    safe: "bg-success/15 text-success",
    review: "bg-warning/15 text-warning",
    fraud: "bg-destructive/15 text-destructive",
    pending: "bg-primary/15 text-primary",
    active: "bg-success/15 text-success",
    inactive: "bg-destructive/15 text-destructive",
    suspended: "bg-destructive/15 text-destructive",
    open: "bg-destructive/15 text-destructive",
    investigating: "bg-warning/15 text-warning",
    resolved: "bg-success/15 text-success",
  };
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md ${map[s] ?? "bg-secondary text-muted-foreground"}`}>{s}</span>;
}

export function RiskBar({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="text-xs text-muted-foreground">Pending</span>;
  }

  const safeValue = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const color = safeValue >= 70 ? "bg-destructive" : safeValue >= 40 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-2 w-28">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden"><div className={`h-full ${color}`} style={{ width: `${safeValue}%` }} /></div>
      <span className="text-xs w-6 font-mono">{safeValue}</span>
    </div>
  );
}

function TxModal({ tx, predicting, onPredict, onClose }: { tx: Transaction; predicting: boolean; onPredict: () => void; onClose: () => void }) {
  return (
    <Modal title={`Transaction TX-${tx.id}`} onClose={onClose}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{tx.transactionType}</p>
          <p className="font-display text-lg font-semibold">{tx.merchant}</p>
        </div>
        <StatusBadge s={tx.status} />
      </div>
      <div className="grid grid-cols-2 gap-3 mt-6 text-sm">
        {[
          ["Merchant", tx.merchant], ["Category", tx.category], ["Country", tx.country],
          ["Amount", formatCurrency(tx.amount, tx.currency)], ["Risk score", tx.riskScore == null ? "Pending" : `${tx.riskScore}/100`],
          ["Time", formatDateTime(tx.createdAt)], ["Currency", tx.currency], ["Type", tx.transactionType],
        ].map(([key, value]) => <Metric key={key} label={key} value={value} />)}
      </div>
      {tx.description && <div className="mt-4 glass rounded-lg p-3 text-sm text-muted-foreground">{tx.description}</div>}
      <div className="mt-4 glass rounded-lg p-3">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Analysis Result
        </div>
        <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
          <Metric label="Status" value={<StatusBadge s={tx.status} />} />
          <Metric label="Confidence" value={tx.latestPredictionConfidence == null ? "Pending" : `${Math.round(tx.latestPredictionConfidence * 100)}%`} />
        </div>
        {tx.latestPredictionExplanation && tx.latestPredictionExplanation.length > 0 ? (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {tx.latestPredictionExplanation.map((reason) => <li key={reason}>- {formatExplanationFactor(reason)}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No prediction has been run for this transaction yet.</p>
        )}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onPredict} disabled={predicting} className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-60">
          {predicting ? "Scoring..." : tx.latestPredictionId ? "Re-analyze" : "Run Analysis"}
        </button>
        <button onClick={onClose} className="glass rounded-lg px-4 py-2 text-sm">Close</button>
      </div>
    </Modal>
  );
}

function CreateTransactionModal({ form, saving, onChange, onClose, onSubmit }: { form: TransactionForm; saving: boolean; onChange: (form: TransactionForm) => void; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const update = (key: keyof TransactionForm, value: string) => onChange({ ...form, [key]: value });
  return (
    <Modal title="Add Transaction" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Merchant" value={form.merchant} onChange={(value) => update("merchant", value)} required />
          <SearchableSelect label="Category" value={form.category} options={categories} placeholder="Select category" onChange={(value) => update("category", value)} />
          <SearchableSelect label="Country" value={form.country} options={countries} placeholder="Select country" onChange={(value) => update("country", value)} />
          <Field label="Amount" type="number" value={form.amount} onChange={(value) => update("amount", value)} required min="0.01" step="0.01" />
          <Field label="Currency" value={form.currency} onChange={(value) => update("currency", value)} required />
          <Select label="Transaction Type" value={form.transactionType} options={["PAYMENT", "TRANSFER", "CASH_OUT", "CASH_IN", "DEBIT"]} onChange={(value) => update("transactionType", value)} />
        </div>
        <label className="block">
          <span className="text-xs text-muted-foreground">Description</span>
          <textarea value={form.description} onChange={(event) => update("description", event.target.value)} className="mt-1 min-h-20 w-full glass rounded-lg px-3 py-2.5 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary/60" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="glass rounded-lg px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-60">{saving ? "Creating..." : "Create transaction"}</button>
        </div>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="glass-strong rounded-2xl max-w-lg w-full p-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display font-semibold text-lg">{title}</p>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, min, step }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; min?: string; step?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input type={type} value={value} required={required} min={min} step={step} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary/60" />
    </label>
  );
}

function SearchableSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? options.filter((option) => option.toLowerCase().includes(term)) : options;
  }, [options, query]);

  const displayValue = open ? query : value;

  return (
    <label className="block relative">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        value={displayValue}
        required
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && filtered[0]) {
            event.preventDefault();
            onChange(filtered[0]);
            setQuery("");
            setOpen(false);
          }
        }}
        className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm bg-background/60 text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/60"
      />
      {open && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto glass-strong rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur-xl">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
          ) : filtered.map((option) => (
            <button
              type="button"
              key={option}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option);
                setQuery("");
                setOpen(false);
              }}
              className={`block w-full cursor-pointer select-none px-3 py-2 text-left text-sm no-underline outline-none transition-none
                ${option === value
                  ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary focus:bg-primary/20 focus:text-primary"
                  : "text-foreground hover:bg-secondary/70 hover:text-foreground focus:bg-secondary/70 focus:text-foreground"
                }`}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full cursor-pointer glass rounded-lg px-3 py-2.5 text-sm bg-background text-foreground outline-none focus:ring-1 focus:ring-primary/60">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="glass rounded-lg p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium mt-0.5">{value}</p></div>;
}

function StatePanel({ title, message, destructive }: { title: string; message: string; destructive?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      <Loader2 className={`h-10 w-10 mx-auto ${destructive ? "hidden" : "animate-spin text-primary"}`} />
      <h2 className="mt-4 text-xl font-display font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(value ?? 0);
}

function formatExplanationFactor(reason: string) {
  const delimiter = reason.indexOf("|");
  return delimiter === -1 ? reason : reason.slice(delimiter + 1).trim();
}

function formatDateTime(value: string) {
  return value ? new Date(value).toLocaleString() : "";
}
