import { FraudSelect } from "@/components/common/FraudSelect";
import { Topbar } from "@/components/layout/Topbar";
import { adminMerchantService, type AdminMerchantFilters } from "@/services/adminMerchantService";
import { bankingService } from "@/services/bankingService";
import type { AdminMerchant, Bank, UpsertMerchantInput } from "@/types/banking";
import { useNavigate } from "@tanstack/react-router";
import { Building2, Eye, Loader2, Pencil, Plus, Search, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const categories = [
  "Grocery",
  "Retail",
  "Electronics",
  "Restaurant",
  "Travel",
  "Utilities",
  "Healthcare",
  "Entertainment",
  "Fuel",
  "Online Services",
  "Books",
  "Other",
];
const riskLevels = ["Low", "Medium", "High"];
const countries = ["Kosovo", "Albania", "North Macedonia", "Montenegro"];

const blankForm: UpsertMerchantInput = {
  name: "",
  merchantCode: "",
  category: "Grocery",
  merchantCategoryCode: "",
  country: "Kosovo",
  bankId: 0,
  riskLevel: "Low",
  isVerified: true,
  isActive: true,
};

export default function AdminMerchantsPage() {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState<AdminMerchant[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filters, setFilters] = useState<AdminMerchantFilters>({ active: "all" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminMerchant | null>(null);
  const [viewing, setViewing] = useState<AdminMerchant | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<UpsertMerchantInput>(blankForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadBanks();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadMerchants(), 200);
    return () => window.clearTimeout(timeout);
  }, [filters.search, filters.category, filters.bankId, filters.riskLevel, filters.active]);

  const pagedRows = useMemo(() => merchants.slice(0, 50), [merchants]);

  async function loadBanks() {
    try {
      setBanks(await bankingService.getBanks());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load banks.");
    }
  }

  async function loadMerchants() {
    setLoading(true);
    setError(null);
    try {
      setMerchants(await adminMerchantService.getMerchants(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load merchants.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...blankForm, bankId: banks[0]?.id ?? 0 });
    setFormOpen(true);
  }

  function openEdit(merchant: AdminMerchant) {
    setEditing(merchant);
    setForm({
      name: merchant.name,
      merchantCode: merchant.merchantCode,
      category: merchant.category,
      merchantCategoryCode: merchant.merchantCategoryCode ?? "",
      country: merchant.country,
      bankId: merchant.bankId,
      riskLevel: merchant.riskLevel,
      isVerified: merchant.isVerified,
      isActive: merchant.isActive,
    });
    setFormOpen(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        merchantCode: form.merchantCode.trim().toUpperCase(),
        merchantCategoryCode: form.merchantCategoryCode?.trim() || null,
      };
      const saved = editing
        ? await adminMerchantService.updateMerchant(editing.id, payload)
        : await adminMerchantService.createMerchant(payload);
      setMerchants((current) => editing
        ? current.map((merchant) => merchant.id === saved.id ? saved : merchant)
        : [saved, ...current]);
      toast.success(editing ? "Merchant updated." : "Merchant created.");
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save merchant.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(merchant: AdminMerchant) {
    try {
      const updated = merchant.isActive
        ? await adminMerchantService.deactivate(merchant.id)
        : await adminMerchantService.activate(merchant.id);
      setMerchants((current) => current.map((item) => item.id === updated.id ? updated : item));
      toast.success(updated.isActive ? "Merchant activated." : "Merchant deactivated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update merchant status.");
    }
  }

  return (
    <>
      <Topbar title="Merchants" subtitle={`${merchants.length} simulated merchant records`} />
      <main className="flex-1 min-w-0 overflow-x-hidden p-4 md:p-8 space-y-4">
        <section className="glass rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="glass flex min-w-[240px] flex-1 items-center gap-2 rounded-lg px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={filters.search ?? ""}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search merchant name, code, category..."
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </div>
            <Filter value={filters.category ?? "all"} options={["all", ...categories]} onChange={(value) => setFilters((current) => ({ ...current, category: value }))} />
            <Filter value={filters.bankId ?? "all"} options={[{ value: "all", label: "All banks" }, ...banks.map((bank) => ({ value: String(bank.id), label: bank.name }))]} onChange={(value) => setFilters((current) => ({ ...current, bankId: value }))} />
            <Filter value={filters.riskLevel ?? "all"} options={["all", ...riskLevels]} onChange={(value) => setFilters((current) => ({ ...current, riskLevel: value }))} />
            <Filter value={filters.active ?? "all"} options={["all", "active", "inactive"]} onChange={(value) => setFilters((current) => ({ ...current, active: value as AdminMerchantFilters["active"] }))} />
            <button onClick={openCreate} className="bg-gradient-primary text-primary-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm">
              <Plus className="h-4 w-4" /> Add Merchant
            </button>
          </div>
        </section>

        {loading && <StatePanel title="Loading merchants" message="Fetching merchant records." />}
        {!loading && error && <StatePanel title="Merchants unavailable" message={error} destructive />}
        {!loading && !error && (
          <section className="glass max-w-full overflow-hidden rounded-2xl">
            <div className="scrollbar-thin max-w-full overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {["Name", "Code", "Category", "MCC", "Country", "Bank", "Settlement", "Risk", "Verified", "Status", "Created", "Actions"].map((header) => (
                      <th key={header} className="px-4 py-3 text-left font-medium">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.length === 0 ? (
                    <tr className="border-t border-border">
                      <td colSpan={12} className="px-4 py-10 text-center text-muted-foreground">No merchants found.</td>
                    </tr>
                  ) : pagedRows.map((merchant) => (
                    <tr key={merchant.id} className="border-t border-border hover:bg-secondary/40">
                      <td className="px-4 py-3 font-medium">{merchant.name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{merchant.merchantCode}</td>
                      <td className="px-4 py-3">{merchant.category}</td>
                      <td className="px-4 py-3 font-mono text-xs">{merchant.merchantCategoryCode ?? "Not set"}</td>
                      <td className="px-4 py-3">{merchant.country}</td>
                      <td className="px-4 py-3">{merchant.bankName}</td>
                      <td className="px-4 py-3 font-mono text-xs">{merchant.maskedSettlementAccount ?? "Pending"}</td>
                      <td className="px-4 py-3"><RiskBadge value={merchant.riskLevel} /></td>
                      <td className="px-4 py-3">{merchant.isVerified ? "Verified" : "Unverified"}</td>
                      <td className="px-4 py-3">{merchant.isActive ? "Active" : "Inactive"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(merchant.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setViewing(merchant)} className="glass rounded-lg p-2" title="View merchant details"><Eye className="h-4 w-4" /></button>
                          <button onClick={() => openEdit(merchant)} className="glass rounded-lg p-2" title="Edit merchant"><Pencil className="h-4 w-4" /></button>
                          <button onClick={() => navigate({ to: "/admin/transactions" })} className="glass rounded-lg px-3 py-2 text-xs">
                            Transactions
                          </button>
                          <button onClick={() => void toggleActive(merchant)} className="glass rounded-lg px-3 py-2 text-xs">
                            {merchant.isActive ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
      {formOpen && (
        <MerchantForm
          title={editing ? "Edit Merchant" : "Add Merchant"}
          form={form}
          banks={banks}
          saving={saving}
          onChange={setForm}
          onSubmit={submit}
          onClose={() => setFormOpen(false)}
        />
      )}
      {viewing && (
        <Modal title={viewing.name} onClose={() => setViewing(null)}>
          <div className="space-y-3 text-sm">
            <Detail label="Merchant code" value={viewing.merchantCode} />
            <Detail label="Settlement account" value={viewing.maskedSettlementAccount ?? "Pending"} />
            <Detail label="Settlement IBAN" value={viewing.maskedSettlementIban ?? "Pending"} />
            <Detail label="Balance" value="Hidden from merchant management UI" />
            <p className="text-xs text-muted-foreground">Settlement accounts are simulated academic data and are credited only by server-controlled payment processing.</p>
          </div>
        </Modal>
      )}
    </>
  );
}

function MerchantForm({ title, form, banks, saving, onChange, onSubmit, onClose }: { title: string; form: UpsertMerchantInput; banks: Bank[]; saving: boolean; onChange: (form: UpsertMerchantInput) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onClose: () => void }) {
  const update = (key: keyof UpsertMerchantInput, value: string | boolean | number) => onChange({ ...form, [key]: value });
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Merchant name" value={form.name} onChange={(value) => update("name", value)} maxLength={100} required />
          <Field label="Merchant code" value={form.merchantCode} onChange={(value) => update("merchantCode", value.toUpperCase())} maxLength={40} required mono />
          <Select label="Category" value={form.category} options={categories} onChange={(value) => update("category", value)} />
          <Field label="MCC" value={form.merchantCategoryCode ?? ""} onChange={(value) => update("merchantCategoryCode", value)} maxLength={6} mono />
          <Select label="Country" value={form.country} options={countries} onChange={(value) => update("country", value)} />
          <Select label="Bank" value={String(form.bankId || "")} options={banks.map((bank) => ({ value: String(bank.id), label: `${bank.name} - ${bank.country}` }))} onChange={(value) => update("bankId", Number(value))} placeholder="Select bank" />
          <Select label="Risk level" value={form.riskLevel} options={riskLevels} onChange={(value) => update("riskLevel", value)} />
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isVerified} onChange={(event) => update("isVerified", event.target.checked)} />
            Verified
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isActive} onChange={(event) => update("isActive", event.target.checked)} />
            Active
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Settlement account number, simulated IBAN, EUR currency, and starting balance are generated by the backend.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="glass rounded-lg px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-60">
            {saving ? "Saving..." : "Save Merchant"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, value, onChange, required, maxLength, mono }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; maxLength?: number; mono?: boolean }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} required={required} maxLength={maxLength} className={`glass mt-1 w-full rounded-lg bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/60 ${mono ? "font-mono" : ""}`} />
    </label>
  );
}

type Option = string | { value: string; label: string };
function Select({ label, value, options, onChange, placeholder }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; placeholder?: string }) {
  const normalized = options.map((option) => typeof option === "string" ? { value: option, label: option } : option);
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1">
        <FraudSelect value={value} onValueChange={onChange} options={normalized} placeholder={placeholder} ariaLabel={label} triggerClassName="min-h-10 w-full px-3 py-2.5 text-sm" />
      </div>
    </label>
  );
}

function Filter({ value, options, onChange }: { value: string; options: Option[]; onChange: (value: string) => void }) {
  return <Select label="" value={value} options={options} onChange={onChange} />;
}

function RiskBadge({ value }: { value: string }) {
  const style = value === "High" ? "bg-destructive/15 text-destructive" : value === "Medium" ? "bg-warning/15 text-warning" : "bg-success/15 text-success";
  return <span className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wider ${style}`}>{value}</span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm">{value}</p>
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

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className="glass-strong scrollbar-thin max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl p-6">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display text-lg font-semibold">{title}</p>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
