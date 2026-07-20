import { Topbar } from "@/components/layout/Topbar";
import { bankingService } from "@/services/bankingService";
import type { BankAccount } from "@/types/banking";
import { formatCurrency } from "@/utils/formatters";
import { Building2, CreditCard, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows = await bankingService.getAccounts();
        if (active) setAccounts(rows);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Unable to load bank accounts.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Topbar title="My Accounts" subtitle="Demo banking accounts, no live banking integration" />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        {loading && <StatePanel title="Loading accounts" message="Fetching your demo bank accounts." />}
        {!loading && error && <StatePanel title="Accounts unavailable" message={error} destructive />}
        {!loading && !error && accounts.length === 0 && <StatePanel title="No accounts" message="No demo bank accounts are linked to your profile." />}
        {!loading && !error && accounts.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <div key={account.id} className="glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wider ${account.isActive ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {account.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-4 font-display font-semibold">{account.bankName}</p>
                <p className="text-sm text-muted-foreground">{account.accountType}</p>
                <div className="mt-4 space-y-2 text-sm">
                  <Row label="Account" value={account.maskedAccountNumber} />
                  <Row label="IBAN" value={account.maskedIban} />
                  <Row label="Currency" value={account.currency} />
                </div>
                <div className="mt-5 rounded-xl border border-border/60 bg-background/30 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Current balance</p>
                  <p className="mt-1 font-mono text-2xl font-semibold">{formatCurrency(account.currentBalance, account.currency)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function StatePanel({ title, message, destructive }: { title: string; message: string; destructive?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      {destructive ? <Building2 className="mx-auto h-10 w-10 text-destructive" /> : <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}
      <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
