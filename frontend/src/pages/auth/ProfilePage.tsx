import { Topbar } from "@/components/layout/Topbar";
import { Shield, Activity, Clock, Mail, KeyRound, MapPin } from "lucide-react";

export default function Profile() {
  return (
    <>
      <Topbar title="Profile & Settings" subtitle="Manage your account, preferences and security"/>
      <main className="flex-1 p-4 md:p-8 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-4">
          <div className="glass rounded-2xl p-6 text-center">
            <div className="mx-auto h-24 w-24 rounded-full bg-gradient-primary grid place-items-center text-3xl font-display font-semibold text-primary-foreground ring-glow">SA</div>
            <p className="mt-4 text-lg font-display font-semibold">Sara Amrani</p>
            <p className="text-xs text-muted-foreground">Senior Fraud Analyst</p>
            <div className="mt-4 flex justify-center gap-2 text-xs">
              <span className="glass rounded-full px-3 py-1">Analyst</span>
              <span className="bg-success/15 text-success rounded-full px-3 py-1">Active</span>
            </div>
          </div>
          <div className="glass rounded-2xl p-5 space-y-3 text-sm">
            <Row icon={Mail} label="Email" value="sara@sentinel.ai"/>
            <Row icon={MapPin} label="Location" value="Casablanca, MA"/>
            <Row icon={Clock} label="Joined" value="March 2025"/>
            <Row icon={Activity} label="Predictions run" value="14,820"/>
          </div>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <div className="glass rounded-2xl p-6">
            <p className="font-display font-semibold">Account information</p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <Field label="Full name" defaultValue="Sara Amrani"/>
              <Field label="Email" defaultValue="sara@sentinel.ai"/>
              <Field label="Role" defaultValue="Analyst"/>
              <Field label="Timezone" defaultValue="Africa/Casablanca"/>
            </div>
            <button className="mt-5 bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm">Save changes</button>
          </div>

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
                ["Signed in from Chrome - Casablanca", "2 min ago"],
                ["Resolved alert ALT-1042", "1 h ago"],
                ["Ran 12 AI predictions", "Today, 09:14"],
                ["Updated security preferences", "Yesterday"],
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

function Row({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-primary"/>
      <div className="flex-1"><p className="text-xs text-muted-foreground">{label}</p><p>{value}</p></div>
    </div>
  );
}

function Field({ label, defaultValue }: any) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input defaultValue={defaultValue} className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-primary/60"/>
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
      <button className={`h-6 w-11 rounded-full p-0.5 transition ${on ? "bg-gradient-primary" : "bg-secondary"}`}>
        <span className={`block h-5 w-5 rounded-full bg-background transition ${on ? "translate-x-5" : ""}`}/>
      </button>
    </div>
  );
}