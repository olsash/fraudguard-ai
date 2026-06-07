import { Topbar } from "@/components/layout/Topbar";
import { ApiError } from "@/services/api";
import { authService } from "@/services/authService";
import { settingsService } from "@/services/settingsService";
import { KeyRound, Loader2, Trash2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === "admin";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPassword) {
      toast.error("Current password is required.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }

    setChangingPassword(true);
    try {
      const response = await settingsService.changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(response.message);
    } catch (err) {
      handleSettingsError(err);
    } finally {
      setChangingPassword(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const response = await settingsService.deleteAccount();
      authService.signOut();
      toast.success(response.message);
      await navigate({ to: "/login", replace: true });
    } catch (err) {
      handleSettingsError(err);
      setDeleting(false);
    }
  }

  function handleSettingsError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) {
      authService.signOut();
      toast.error("Your session has expired. Please sign in again.");
      void navigate({ to: "/login", replace: true });
      return;
    }
    toast.error(err instanceof Error ? err.message : "Unable to update settings.");
  }

  return (
    <>
      <Topbar title="Settings" subtitle="Account security and personal preferences" />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <section className="glass rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <KeyRound className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-display font-semibold">Account Security</h2>
              <p className="text-xs text-muted-foreground">Change the password used to access your FraudGuard account.</p>
            </div>
          </div>
          <form onSubmit={changePassword} className="mt-6 grid md:grid-cols-3 gap-4">
            <PasswordField label="Current password" value={currentPassword} onChange={setCurrentPassword} />
            <PasswordField label="New password" value={newPassword} onChange={setNewPassword} />
            <PasswordField label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
            <button
              type="submit"
              disabled={changingPassword}
              className="md:col-span-3 w-fit bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60"
            >
              {changingPassword ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</> : "Change password"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5 text-destructive" />
            <div>
              <h2 className="font-display font-semibold text-destructive">Danger Zone</h2>
              <p className="text-xs text-muted-foreground">Account deletion disables future sign-ins.</p>
            </div>
          </div>
          {isAdmin ? (
            <p className="mt-5 rounded-lg border border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
              Admin accounts cannot be deleted from here.
            </p>
          ) : (
            <button type="button" onClick={() => setDeleteOpen(true)} className="mt-5 rounded-lg border border-destructive/40 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10">
              Delete account
            </button>
          )}
        </section>
      </main>

      {deleteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" className="glass w-full max-w-md rounded-2xl p-6 ring-1 ring-destructive/30">
            <h2 className="font-display text-lg font-semibold">Delete account?</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Are you sure you want to permanently delete your account? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" disabled={deleting} onClick={() => setDeleteOpen(false)} className="glass rounded-lg px-4 py-2 text-sm">Cancel</button>
              <button type="button" disabled={deleting} onClick={() => void deleteAccount()} className="rounded-lg bg-destructive px-4 py-2 text-sm text-destructive-foreground disabled:opacity-60">
                {deleting ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="password"
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/60"
      />
    </label>
  );
}
