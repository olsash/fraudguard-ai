import { Topbar } from "@/components/layout/Topbar";

export default function AdminSettings() {
  return (
    <>
      <Topbar title="Platform Settings" subtitle="System configuration and security policies"/>
      <main className="flex-1 p-4 md:p-8 grid lg:grid-cols-2 gap-4">
        <Section title="Detection thresholds">
          <Range label="Auto-block threshold" value={85}/>
          <Range label="Challenge threshold" value={60}/>
          <Range label="Review threshold" value={30}/>
        </Section>
        <Section title="Notifications">
          <Toggle label="Slack alerts on critical fraud" on/>
          <Toggle label="Email digest (daily)" on/>
          <Toggle label="SMS escalation on SLA breach"/>
        </Section>
        <Section title="Data & retention">
          <Field label="Retention period (days)" defaultValue="365"/>
          <Field label="Dataset refresh frequency" defaultValue="Hourly"/>
        </Section>
        <Section title="API & integrations">
          <Field label="Webhook URL" defaultValue="https://api.bank.io/fraud/webhook"/>
          <Field label="API rate limit (rps)" defaultValue="500"/>
        </Section>
      </main>
    </>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="glass rounded-2xl p-6">
      <p className="font-display font-semibold">{title}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function Range({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span>{label}</span><span className="text-primary font-mono">{value}</span></div>
      <input type="range" defaultValue={value} className="w-full mt-1 accent-primary"/>
    </div>
  );
}

function Toggle({ label, on }: { label: string; on?: boolean }) {
  return (
    <div className="flex items-center justify-between glass rounded-lg p-3">
      <span className="text-sm">{label}</span>
      <span className={`h-6 w-11 rounded-full p-0.5 ${on ? "bg-gradient-primary" : "bg-secondary"}`}>
        <span className={`block h-5 w-5 rounded-full bg-background transition ${on ? "translate-x-5" : ""}`}/>
      </span>
    </div>
  );
}

function Field({ label, defaultValue }: any) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input defaultValue={defaultValue} className="mt-1 w-full glass rounded-lg px-3 py-2.5 text-sm outline-none"/>
    </label>
  );
}