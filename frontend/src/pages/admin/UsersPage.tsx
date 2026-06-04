import { Topbar } from "@/components/layout/Topbar";
import { adminUserService } from "@/services/adminUserService";
import type { AdminUser, AdminUserDetails, AdminUserRole, AdminUserStatus, CreateAdminUserInput, UpdateAdminUserInput } from "@/types/adminUser";
import { ChevronRight, Eye, Loader2, Pencil, Search, Trash2, UserPlus, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RiskBar, Td, Th } from "@/pages/transactions/TransactionsPage";

const blankForm = {
  fullName: "",
  email: "",
  password: "",
  phoneNumber: "",
  role: "User" as AdminUserRole,
  status: "Active" as AdminUserStatus,
};

type UserForm = typeof blankForm;

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | AdminUserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | AdminUserStatus>("all");
  const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserForm>(blankForm);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState<AdminUserDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  const rows = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch = `${user.fullName} ${user.email}`.toLowerCase().includes(q.toLowerCase());
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, q, roleFilter, statusFilter]);

  async function loadUsers() {
    setLoading(true);
    setError(null);

    try {
      setUsers(await adminUserService.getUsers());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load users.";
      setError(message);
      if (message === "Admin access required.") {
        toast.error("Admin access required");
      }
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(blankForm);
    setEditingUser(null);
    setFormMode("create");
  }

  function openEdit(user: AdminUser) {
    setEditingUser(user);
    setForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      phoneNumber: user.phoneNumber ?? "",
      role: user.role,
      status: user.status,
    });
    setFormMode("edit");
  }

  async function openDetails(user: AdminUser) {
    setDetailsLoading(true);
    setDetails(null);

    try {
      setDetails(await adminUserService.getUserById(user.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load user details.");
    } finally {
      setDetailsLoading(false);
    }
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      if (formMode === "create") {
        const payload: CreateAdminUserInput = {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          phoneNumber: form.phoneNumber || null,
          role: form.role,
        };
        const created = await adminUserService.createUser(payload);
        setUsers((current) => [created, ...current]);
        toast.success("User created successfully");
      }

      if (formMode === "edit" && editingUser) {
        const payload: UpdateAdminUserInput = {
          fullName: form.fullName,
          email: form.email,
          phoneNumber: form.phoneNumber || null,
          role: form.role,
          status: form.status,
        };
        const updated = await adminUserService.updateUser(editingUser.id, payload);
        setUsers((current) => current.map((user) => user.id === updated.id ? updated : user));
        toast.success("User updated successfully");
      }

      setFormMode(null);
      setEditingUser(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save user.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser() {
    if (!deleteTarget) return;

    try {
      await adminUserService.deleteUser(deleteTarget.id);
      setUsers((current) => current.filter((user) => user.id !== deleteTarget.id));
      toast.success("User deleted successfully");
      setDeleteTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete user.";
      toast.error(message === "You cannot delete your own account." ? "You cannot delete your own account" : message);
    }
  }

  return (
    <>
      <Topbar title="Users Management" subtitle={`${rows.length} of ${users.length} users`} />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 glass rounded-lg px-3 py-2 flex-1 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email..." className="flex-1 bg-transparent text-sm outline-none" />
          </div>
          <SegmentedFilter value={roleFilter} values={["all", "User", "Admin"]} onChange={(value) => setRoleFilter(value as "all" | AdminUserRole)} />
          <SegmentedFilter value={statusFilter} values={["all", "Active", "Inactive"]} onChange={(value) => setStatusFilter(value as "all" | AdminUserStatus)} />
          <button onClick={openCreate} className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Add user
          </button>
        </div>

        {loading && <StatePanel icon={Loader2} title="Loading users" message="Fetching registered users from FraudGuard API." spin />}
        {!loading && error && <StatePanel title="Users unavailable" message={error} destructive />}
        {!loading && !error && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1120px]">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <Th>Name</Th>
                    <Th>Email</Th>
                    <Th>Role</Th>
                    <Th>Status</Th>
                    <Th>Total Predictions</Th>
                    <Th>Average Risk Score</Th>
                    <Th>Highest Risk Score</Th>
                    <Th>Fraud Count</Th>
                    <Th>Created At</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr className="border-t border-border">
                      <td colSpan={10} className="px-4 py-10 text-center text-sm text-muted-foreground">No users found.</td>
                    </tr>
                  ) : rows.map((user) => (
                    <tr key={user.id} className="border-t border-border hover:bg-secondary/40">
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={user.fullName} />
                          <span className="font-medium">{user.fullName}</span>
                        </div>
                      </Td>
                      <Td className="text-muted-foreground">{user.email}</Td>
                      <Td><RoleBadge role={user.role} /></Td>
                      <Td><StatusBadge status={user.status} /></Td>
                      <Td className="font-mono">{user.totalPredictions}</Td>
                      <Td><RiskBar value={Math.round(user.averageRiskScore)} /></Td>
                      <Td><RiskBar value={user.highestRiskScore} /></Td>
                      <Td className={user.fraudPredictionsCount > 0 ? "font-mono text-destructive" : "font-mono text-muted-foreground"}>{user.fraudPredictionsCount}</Td>
                      <Td className="text-xs text-muted-foreground">{formatDate(user.createdAt)}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <button onClick={() => void openDetails(user)} className="h-7 w-7 grid place-items-center rounded hover:bg-secondary" title="View"><Eye className="h-3.5 w-3.5" /></button>
                          <button onClick={() => openEdit(user)} className="h-7 w-7 grid place-items-center rounded hover:bg-secondary" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => setDeleteTarget(user)} className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                          <button onClick={() => void openDetails(user)} className="h-7 w-7 grid place-items-center rounded hover:bg-secondary" title="Details"><ChevronRight className="h-3.5 w-3.5" /></button>
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

      {formMode && (
        <UserFormModal
          mode={formMode}
          form={form}
          saving={saving}
          onChange={setForm}
          onClose={() => setFormMode(null)}
          onSubmit={saveUser}
        />
      )}

      {(detailsLoading || details) && (
        <DetailsModal loading={detailsLoading} details={details} onClose={() => setDetails(null)} />
      )}

      {deleteTarget && (
        <DeleteDialog user={deleteTarget} onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteUser()} />
      )}
    </>
  );
}

function SegmentedFilter({ value, values, onChange }: { value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      {values.map((item) => (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={`text-xs px-3 py-1.5 rounded-lg capitalize ${value === item ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function UserFormModal({
  mode,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  form: UserForm;
  saving: boolean;
  onChange: (form: UserForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = (key: keyof UserForm, value: string) => onChange({ ...form, [key]: value });

  return (
    <Modal title={mode === "create" ? "Add user" : "Edit user"} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Full name" value={form.fullName} onChange={(value) => update("fullName", value)} required />
          <Field label="Email" type="email" value={form.email} onChange={(value) => update("email", value)} required />
        </div>
        {mode === "create" && <Field label="Password" type="password" value={form.password} onChange={(value) => update("password", value)} required minLength={6} />}
        <Field label="Phone number" value={form.phoneNumber} onChange={(value) => update("phoneNumber", value)} />
        <div className="grid md:grid-cols-2 gap-3">
          <Select label="Role" value={form.role} options={["User", "Admin"]} onChange={(value) => update("role", value)} />
          {mode === "edit" && <Select label="Status" value={form.status} options={["Active", "Inactive"]} onChange={(value) => update("status", value)} />}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="glass rounded-lg px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-60">
            {saving ? "Saving..." : mode === "create" ? "Create user" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DetailsModal({ loading, details, onClose }: { loading: boolean; details: AdminUserDetails | null; onClose: () => void }) {
  return (
    <Modal title="User details" onClose={onClose} wide>
      {loading && (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" /> Loading user details...
        </div>
      )}
      {!loading && details && (
        <div className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar name={details.fullName} large />
            <div>
              <p className="font-display font-semibold text-lg">{details.fullName}</p>
              <p className="text-xs text-muted-foreground">{details.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Metric label="Role" value={details.role} />
            <Metric label="Status" value={details.status} />
            <Metric label="Predictions" value={details.totalPredictions} />
            <Metric label="Fraud count" value={details.fraudPredictionsCount} />
            <Metric label="Average risk" value={`${details.averageRiskScore}/100`} />
            <Metric label="Highest risk" value={`${details.highestRiskScore}/100`} />
            <Metric label="Created" value={formatDate(details.createdAt)} />
            <Metric label="Last login" value={details.lastLoginAt ? formatDateTime(details.lastLoginAt) : "Never"} />
          </div>
          <div>
            <p className="text-sm font-display font-semibold">Recent predictions</p>
            <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
              {details.recentPredictions.length === 0 ? (
                <p className="text-sm text-muted-foreground">No predictions available yet.</p>
              ) : details.recentPredictions.map((prediction) => (
                <div key={prediction.id} className="rounded-lg border border-border/50 bg-background/30 p-3 text-sm flex items-center gap-3">
                  <div className={prediction.isFraud ? "text-destructive font-semibold" : "text-success font-semibold"}>{prediction.riskScore}/100</div>
                  <div className="flex-1">
                    <p>{prediction.transactionType} - {formatCurrency(prediction.amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(prediction.createdAt)}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{prediction.riskLevel}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DeleteDialog({ user, onCancel, onConfirm }: { user: AdminUser; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal title="Delete user" onClose={onCancel}>
      <p className="text-sm text-muted-foreground">
        Delete <span className="font-medium text-foreground">{user.fullName}</span>? This will also remove their prediction history.
      </p>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onCancel} className="glass rounded-lg px-4 py-2 text-sm">Cancel</button>
        <button onClick={onConfirm} className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground">Delete user</button>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(event) => event.stopPropagation()} className={`glass-strong rounded-2xl w-full p-6 ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        <div className="mb-5 flex items-center justify-between">
          <p className="font-display font-semibold text-lg">{title}</p>
          <button onClick={onClose} className="h-8 w-8 grid place-items-center rounded-lg hover:bg-secondary"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, minLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; minLength?: number }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm bg-transparent outline-none focus:ring-1 focus:ring-primary/60"
      />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm bg-background outline-none">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  );
}

function Avatar({ name, large }: { name: string; large?: boolean }) {
  const initials = name.trim().split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "FG";
  return (
    <div className={`${large ? "h-14 w-14 text-lg" : "h-8 w-8 text-xs"} rounded-full bg-gradient-primary grid place-items-center font-semibold text-primary-foreground`}>
      {initials}
    </div>
  );
}

function RoleBadge({ role }: { role: AdminUserRole }) {
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md ${role === "Admin" ? "bg-accent/20 text-accent" : "bg-secondary text-muted-foreground"}`}>{role}</span>;
}

function StatusBadge({ status }: { status: AdminUserStatus }) {
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md ${status === "Active" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{status}</span>;
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="glass rounded-lg p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium mt-0.5">{value}</p></div>;
}

function StatePanel({ title, message, icon: Icon = Loader2, spin, destructive }: { title: string; message: string; icon?: typeof Loader2; spin?: boolean; destructive?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      <Icon className={`h-10 w-10 mx-auto ${spin ? "animate-spin" : ""} ${destructive ? "text-destructive" : "text-primary"}`} />
      <h2 className="mt-4 text-xl font-display font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
