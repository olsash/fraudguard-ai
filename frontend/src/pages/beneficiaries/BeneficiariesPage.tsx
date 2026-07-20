import { FraudSelect } from "@/components/common/FraudSelect";
import { Topbar } from "@/components/layout/Topbar";
import { bankingService } from "@/services/bankingService";
import type { Bank, Beneficiary } from "@/types/banking";
import { CheckCircle2, Loader2, Plus, UserCheck, X } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

const blankForm = {
  fullName: "",
  bankId: "",
  accountReference: "",
  isTrusted: false,
};

export default function BeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [beneficiaryRows, bankRows] = await Promise.all([
        bankingService.getBeneficiaries(),
        bankingService.getBanks(),
      ]);
      setBeneficiaries(beneficiaryRows);
      setBanks(bankRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load beneficiaries.");
    } finally {
      setLoading(false);
    }
  }

  async function createBeneficiary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const bankId = Number(form.bankId);
    if (!Number.isInteger(bankId) || bankId <= 0) {
      toast.error("Select a bank.");
      return;
    }

    if (!/^[A-Za-z0-9\-\s]{6,34}$/.test(form.accountReference.trim())) {
      toast.error("Account reference must be 6 to 34 letters, numbers, spaces, or hyphens.");
      return;
    }

    setSaving(true);
    try {
      const created = await bankingService.createBeneficiary({
        fullName: form.fullName,
        bankId,
        accountReference: form.accountReference,
        isTrusted: form.isTrusted,
      });
      setBeneficiaries((current) => [created, ...current]);
      setForm(blankForm);
      setShowCreate(false);
      toast.success("Beneficiary saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save beneficiary.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Topbar title="Beneficiaries" subtitle="Saved demo transfer destinations" />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <div className="glass rounded-2xl p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Use saved beneficiaries when creating transfer transactions.</p>
          <button onClick={() => setShowCreate(true)} className="bg-gradient-primary text-primary-foreground rounded-lg px-3 py-2 text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add beneficiary
          </button>
        </div>

        {loading && <StatePanel title="Loading beneficiaries" message="Fetching saved transfer destinations." />}
        {!loading && error && <StatePanel title="Beneficiaries unavailable" message={error} destructive />}
        {!loading && !error && beneficiaries.length === 0 && <StatePanel title="No beneficiaries" message="Save a beneficiary before creating transfer transactions." />}
        {!loading && !error && beneficiaries.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {beneficiaries.map((beneficiary) => (
              <div key={beneficiary.id} className="glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <span className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wider ${beneficiary.isTrusted ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                    {beneficiary.isTrusted ? "Trusted" : "Untrusted"}
                  </span>
                </div>
                <p className="mt-4 font-display font-semibold">{beneficiary.fullName}</p>
                <p className="text-sm text-muted-foreground">{beneficiary.bankName}</p>
                <div className="mt-4 rounded-xl border border-border/60 bg-background/30 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Account reference</p>
                  <p className="mt-1 font-mono text-lg">{beneficiary.maskedAccountReference}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <Modal title="Add beneficiary" onClose={() => setShowCreate(false)}>
          <form onSubmit={createBeneficiary} className="space-y-4">
            <Field label="Name" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} required />
            <label className="block">
              <span className="text-xs text-muted-foreground">Bank</span>
              <div className="mt-1">
                <FraudSelect
                  value={form.bankId}
                  onValueChange={(value) => setForm({ ...form, bankId: value })}
                  options={banks.map((bank) => ({ value: bank.id, label: `${bank.name} (${bank.country})` }))}
                  placeholder="Select bank"
                  ariaLabel="Bank"
                  triggerClassName="min-h-10 w-full px-3 py-2.5 text-sm"
                />
              </div>
            </label>
            <Field label="Account reference" value={form.accountReference} onChange={(value) => setForm({ ...form, accountReference: value })} required />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isTrusted} onChange={(event) => setForm({ ...form, isTrusted: event.target.checked })} className="h-4 w-4 rounded border-border bg-transparent" />
              Mark as trusted
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreate(false)} className="glass rounded-lg px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-60">
                {saving ? "Saving..." : "Save beneficiary"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input value={value} required={required} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full glass rounded-lg bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/60" />
    </label>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="glass-strong w-full max-w-lg rounded-2xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display text-lg font-semibold">{title}</p>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatePanel({ title, message, destructive }: { title: string; message: string; destructive?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      {destructive ? <CheckCircle2 className="mx-auto h-10 w-10 text-destructive" /> : <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />}
      <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
