import { Topbar } from "@/components/layout/Topbar";
import { ApiError } from "@/services/api";
import { authService } from "@/services/authService";
import { profileService } from "@/services/profileService";
import type { ProfileResponse, UpdateProfilePayload } from "@/types/profile";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Clock, Loader2, LockKeyhole, Mail, Phone, Shield, UserRound } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

type ProfileForm = {
  fullName: string;
  phoneNumber: string;
};

const emptyForm: ProfileForm = { fullName: "", phoneNumber: "" };

export default function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const data = await profileService.getMyProfile();
      setProfile(data);
      setForm(toForm(data));
      authService.saveCurrentUser(data);
    } catch (err) {
      await handleRequestError(err, "Unable to load your profile.");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fullName = form.fullName.trim();
    if (!fullName) {
      setError("Full name is required.");
      return;
    }
    if (fullName.length > 150 || form.phoneNumber.trim().length > 50) {
      setError("Please keep full name under 150 characters and phone number under 50 characters.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: UpdateProfilePayload = {
        fullName,
        phoneNumber: form.phoneNumber.trim() || null,
      };
      const updated = await profileService.updateMyProfile(payload);
      setProfile(updated);
      setForm(toForm(updated));
      authService.saveCurrentUser(updated);
      toast.success("Profile updated successfully.");
    } catch (err) {
      await handleRequestError(err, "Unable to save profile changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestError(err: unknown, fallback: string) {
    if (err instanceof ApiError && err.status === 401) {
      authService.signOut();
      toast.error("Your session has expired. Please sign in again.");
      await navigate({ to: "/login" });
      return;
    }
    const message = err instanceof Error ? err.message : fallback;
    setError(message);
    toast.error(message);
  }

  if (loading) {
    return (
      <>
        <Topbar title="My Account" subtitle="Manage your FraudGuard profile" />
        <main className="flex-1 p-4 md:p-8">
          <div className="glass rounded-2xl p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading profile...
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar title="My Account" subtitle="Manage your FraudGuard profile and account details" />
      <main className="flex-1 p-4 md:p-8 grid lg:grid-cols-3 gap-6">
        <section className="space-y-4">
          <div className="glass rounded-2xl p-6 text-center">
            <div className="mx-auto h-24 w-24 rounded-full bg-gradient-primary grid place-items-center text-3xl font-display font-semibold text-primary-foreground ring-glow">
              {getInitials(profile?.fullName ?? form.fullName)}
            </div>
            <p className="mt-4 text-lg font-display font-semibold">{profile?.fullName}</p>
            <p className="text-xs text-muted-foreground">{profile?.email}</p>
            <span className="mt-4 inline-block glass rounded-full px-3 py-1 text-xs">{profile?.role}</span>
          </div>

          <div className="glass rounded-2xl p-5 space-y-4 text-sm">
            <DetailRow icon={Mail} label="Email" value={profile?.email ?? "-"} />
            <DetailRow icon={Phone} label="Phone" value={profile?.phoneNumber || "Not provided"} />
            <DetailRow icon={CalendarDays} label="Created at" value={formatDate(profile?.createdAt)} />
            <DetailRow icon={Clock} label="Last login" value={formatDate(profile?.lastLoginAt)} />
          </div>
        </section>

        <section className="lg:col-span-2">
          <form className="glass rounded-2xl p-6" onSubmit={saveProfile}>
            <div className="flex items-center gap-3">
              <UserRound className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display font-semibold">Profile information</h2>
                <p className="text-xs text-muted-foreground">Only your name and phone number can be changed here.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <Field label="Full name" value={form.fullName} maxLength={150} required onChange={(value) => setForm((current) => ({ ...current, fullName: value }))} />
              <Field label="Phone number" value={form.phoneNumber} maxLength={50} onChange={(value) => setForm((current) => ({ ...current, phoneNumber: value }))} />
              <Field label="Email" value={profile?.email ?? ""} disabled icon={LockKeyhole} />
              <Field label="Role" value={profile?.role ?? ""} disabled icon={Shield} />
            </div>

            {error && <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

            <button type="submit" disabled={saving} className="mt-5 bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2 disabled:opacity-60">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><CheckCircle2 className="h-4 w-4" /> Save changes</>}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

function toForm(profile: ProfileResponse): ProfileForm {
  return { fullName: profile.fullName, phoneNumber: profile.phoneNumber ?? "" };
}

function getInitials(fullName: string) {
  return fullName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "FG";
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words">{value}</p></div>
    </div>
  );
}

function Field({
  label,
  value,
  disabled,
  required,
  maxLength,
  icon: Icon,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
  maxLength?: number;
  icon?: typeof Shield;
  onChange?: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-2 glass rounded-lg px-3 py-2.5 focus-within:ring-1 focus-within:ring-primary/60">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-primary" />}
        <input
          value={value}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
        />
      </div>
    </label>
  );
}
