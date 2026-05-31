import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Shield, Activity, Clock, Mail, KeyRound, MapPin, Phone, Image as ImageIcon } from "lucide-react";
import { ApiError, apiGet, apiPut } from "@/services/api";
import { authService, type BackendAuthUser } from "@/services/authService";

type ProfileResponse = BackendAuthUser & {
  phoneNumber: string | null;
  address: string | null;
  profileImageUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type ProfileForm = {
  fullName: string;
  phoneNumber: string;
  address: string;
  profileImageUrl: string;
};

const emptyForm: ProfileForm = {
  fullName: "",
  phoneNumber: "",
  address: "",
  profileImageUrl: "",
};

export default function Profile() {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setIsLoading(true);
      setError("");

      try {
        const token = authService.getToken();

        if (!token) {
          throw new ApiError(401, "Your session has expired. Please sign in again.");
        }

        const data = await apiGet<ProfileResponse>("/profile/me");

        if (!active) return;

        setProfile(data);
        setForm(toForm(data));
        authService.saveCurrentUser(data);
      } catch (err) {
        if (!active) return;

        if (err instanceof ApiError && err.status === 401) {
          authService.signOut();
          setProfile(null);
          setForm(emptyForm);
          setError("Your session has expired. Please sign in again.");
          return;
        }

        setError(err instanceof Error ? err.message : "Unable to load your profile.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setIsSaving(true);

    try {
      const updated = await apiPut<ProfileResponse>("/profile/me", form);
      setProfile(updated);
      setForm(toForm(updated));
      authService.saveCurrentUser(updated);
      setMessage("Profile updated successfully.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        authService.signOut();
        setError("Your session has expired. Please sign in again.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to save profile changes.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  const initials = getInitials(profile?.fullName ?? "");
  const roleLabel = profile?.role ?? "User";
  const joined = profile?.createdAt ? formatDate(profile.createdAt) : "-";
  const updated = profile?.updatedAt ? formatDate(profile.updatedAt) : "Not updated yet";

  return (
    <>
      <Topbar title="Profile & Settings" subtitle="Manage your account, preferences and security"/>
      <main className="flex-1 p-4 md:p-8 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-4">
          <div className="glass rounded-2xl p-6 text-center">
            {profile?.profileImageUrl ? (
              <img src={profile.profileImageUrl} alt="" className="mx-auto h-24 w-24 rounded-full object-cover ring-glow" />
            ) : (
              <div className="mx-auto h-24 w-24 rounded-full bg-gradient-primary grid place-items-center text-3xl font-display font-semibold text-primary-foreground ring-glow">{initials}</div>
            )}
            <p className="mt-4 text-lg font-display font-semibold">{profile?.fullName ?? "Loading..."}</p>
            <p className="text-xs text-muted-foreground">{profile?.email ?? "Loading profile"}</p>
            <div className="mt-4 flex justify-center gap-2 text-xs">
              <span className="glass rounded-full px-3 py-1">{roleLabel}</span>
              <span className="bg-success/15 text-success rounded-full px-3 py-1">Active</span>
            </div>
          </div>
          <div className="glass rounded-2xl p-5 space-y-3 text-sm">
            <Row icon={Mail} label="Email" value={profile?.email ?? "-"}/>
            <Row icon={Phone} label="Phone" value={profile?.phoneNumber ?? "-"}/>
            <Row icon={MapPin} label="Address" value={profile?.address ?? "-"}/>
            <Row icon={Clock} label="Joined" value={joined}/>
            <Row icon={Activity} label="Updated" value={updated}/>
          </div>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <form className="glass rounded-2xl p-6" onSubmit={handleSubmit}>
            <p className="font-display font-semibold">Account information</p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Field label="Full name" value={form.fullName} onChange={(value) => setForm((current) => ({ ...current, fullName: value }))} disabled={isLoading} required/>
              <Field label="Email" value={profile?.email ?? ""} disabled/>
              <Field label="Role" value={profile?.role ?? ""} disabled/>
              <Field label="Phone number" value={form.phoneNumber} onChange={(value) => setForm((current) => ({ ...current, phoneNumber: value }))} disabled={isLoading}/>
              <Field label="Address" value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} disabled={isLoading}/>
              <Field label="Profile image URL" value={form.profileImageUrl} onChange={(value) => setForm((current) => ({ ...current, profileImageUrl: value }))} disabled={isLoading} icon={ImageIcon}/>
            </div>
            {message && <p className="mt-4 text-xs text-success">{message}</p>}
            {error && <p className="mt-4 text-xs text-destructive">{error}</p>}
            <button disabled={isLoading || isSaving} className="mt-5 bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm disabled:opacity-60">
              {isSaving ? "Saving..." : "Save changes"}
            </button>
          </form>

          <div className="glass rounded-2xl p-6">
            <p className="font-display font-semibold flex items-center gap-2"><Shield className="h-4 w-4 text-primary"/> Security</p>
            <div className="mt-4 space-y-3 text-sm">
              <Toggle label="Two-factor authentication" sub="Required by your organization" on/>
              <Toggle label="Email alerts on suspicious login" on/>
              <Toggle label="Block sign-ins from new countries"/>
              <Toggle label="Dark mode" on/>
            </div>
            <button className="mt-5 glass rounded-lg px-4 py-2 text-sm flex items-center gap-2"><KeyRound className="h-4 w-4"/> Change password</button>
          </div>

          <div className="glass rounded-2xl p-6">
            <p className="font-display font-semibold">Recent activity</p>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                ["Signed in to FraudGuard", "Current session"],
                ["Loaded profile data", "Today"],
                ["Role verified from JWT", roleLabel],
                ["Profile last updated", updated],
              ].map(([t, d]) => (
                <li key={t} className="flex justify-between border-b border-border/50 pb-2 last:border-0">
                  <span>{t}</span><span className="text-xs text-muted-foreground">{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </>
  );
}

function toForm(profile: ProfileResponse): ProfileForm {
  return {
    fullName: profile.fullName,
    phoneNumber: profile.phoneNumber ?? "",
    address: profile.address ?? "",
    profileImageUrl: profile.profileImageUrl ?? "",
  };
}

function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "FG";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function Row({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-primary"/>
      <div className="flex-1"><p className="text-xs text-muted-foreground">{label}</p><p>{value}</p></div>
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
  icon?: any;
  onChange?: (value: string) => void;
};

function Field({ label, value, disabled, required, icon: Icon, onChange }: FieldProps) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-2 glass rounded-lg px-3 py-2.5 focus-within:ring-1 focus-within:ring-primary/60">
        {Icon && <Icon className="h-4 w-4 text-primary"/>}
        <input
          value={value}
          disabled={disabled}
          required={required}
          onChange={(event) => onChange?.(event.target.value)}
          className="w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
        />
      </div>
    </label>
  );
}

function Toggle({ label, sub, on }: { label: string; sub?: string; on?: boolean }) {
  return (
    <div className="flex items-center justify-between glass rounded-lg p-3">
      <div>
        <p className="font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      <button type="button" className={`h-6 w-11 rounded-full p-0.5 transition ${on ? "bg-gradient-primary" : "bg-secondary"}`}>
        <span className={`block h-5 w-5 rounded-full bg-background transition ${on ? "translate-x-5" : ""}`}/>
      </button>
    </div>
  );
}
