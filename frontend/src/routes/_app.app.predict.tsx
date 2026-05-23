import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/topbar";
import { useState } from "react";
import {
  Sparkles, ShieldCheck, AlertTriangle, Loader2, Cpu, Zap, MapPin, Smartphone, CreditCard, Clock,
} from "lucide-react";

export const Route = createFileRoute("/_app/app/predict")({
  component: Predict,
});

type Result = {
  proba: number; risk: "Low" | "Medium" | "High" | "Critical";
  fraud: boolean; confidence: number; reasons: string[]; action: string;
};

function Predict() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [form, setForm] = useState({
    amount: "1240", merchant: "GlobalRetail",
    category: "Electronics", country: "BR",
    device: "Mobile", txType: "Card-not-present",
    method: "Credit Card", time: "02:14",
    ipRisk: "High", freq: "12", pattern: "Unusual",
  });

  const run = () => {
    setLoading(true); setResult(null);
    setTimeout(() => {
      const amt = +form.amount;
      const fraudy = amt > 800 || form.ipRisk === "High" || form.country === "BR";
      const proba = fraudy ? 0.78 + Math.random() * 0.2 : Math.random() * 0.3;
      const r: Result = {
        proba, fraud: proba > 0.5,
        confidence: 0.85 + Math.random() * 0.14,
        risk: proba > 0.85 ? "Critical" : proba > 0.6 ? "High" : proba > 0.3 ? "Medium" : "Low",
        reasons: fraudy
          ? ["High-risk IP segment", "Velocity anomaly (12 tx / hr)", "Card-not-present in foreign region", "Amount above 95th percentile"]
          : ["Behavioral pattern matches history", "Known merchant", "Geo-velocity normal"],
        action: proba > 0.85 ? "Block & require step-up auth"
          : proba > 0.6 ? "Challenge with 3-D Secure"
          : proba > 0.3 ? "Allow with monitoring"
          : "Approve",
      };
      setResult(r); setLoading(false);
    }, 1800);
  };

  return (
    <>
      <Topbar title="AI Fraud Detection" subtitle="Score a transaction with our 6-model ensemble"/>
      <main className="flex-1 p-4 md:p-8 grid lg:grid-cols-5 gap-6">
        <section className="lg:col-span-3 glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-9 w-9 rounded-xl bg-gradient-primary grid place-items-center"><Sparkles className="h-4 w-4 text-primary-foreground"/></div>
            <div>
              <h2 className="font-display font-semibold">Transaction details</h2>
              <p className="text-xs text-muted-foreground">All fields are tokenized — no PAN is stored.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Input label="Amount (USD)" icon={CreditCard} value={form.amount} onChange={(v: string)=>setForm({...form, amount: v})}/>
            <Input label="Merchant" value={form.merchant} onChange={(v: string)=>setForm({...form, merchant: v})}/>
            <Select label="Category" value={form.category} options={["Electronics","Retail","Travel","Food","Fuel","Entertainment","Services"]} onChange={(v: string)=>setForm({...form, category: v})}/>
            <Select label="Country" icon={MapPin} value={form.country} options={["US","UK","DE","FR","JP","BR","IN","CA","AU","MA"]} onChange={(v: string)=>setForm({...form, country: v})}/>
            <Select label="Device type" icon={Smartphone} value={form.device} options={["Mobile","Desktop","Tablet","POS","Wearable"]} onChange={(v: string)=>setForm({...form, device: v})}/>
            <Select label="Transaction type" value={form.txType} options={["Card-present","Card-not-present","Recurring","ATM"]} onChange={(v: string)=>setForm({...form, txType: v})}/>
            <Select label="Payment method" value={form.method} options={["Credit Card","Debit Card","Apple Pay","Google Pay","Wallet"]} onChange={(v: string)=>setForm({...form, method: v})}/>
            <Input label="Time (HH:MM)" icon={Clock} value={form.time} onChange={(v: string)=>setForm({...form, time: v})}/>
            <Select label="IP risk level" value={form.ipRisk} options={["Low","Medium","High"]} onChange={(v: string)=>setForm({...form, ipRisk: v})}/>
            <Input label="Prev. tx frequency / hr" value={form.freq} onChange={(v: string)=>setForm({...form, freq: v})}/>
            <Select label="Card usage pattern" value={form.pattern} options={["Normal","Unusual","First time"]} onChange={(v: string)=>setForm({...form, pattern: v})}/>
            <Select label="Behavioral indicator" value="Stable" options={["Stable","Drift","Spike"]} onChange={()=>{}}/>
          </div>
          <button onClick={run} disabled={loading}
            className="mt-6 w-full bg-gradient-primary text-primary-foreground rounded-lg py-3 font-medium ring-glow flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin"/> AI scanning…</> : <><Zap className="h-4 w-4"/> Run AI Prediction</>}
          </button>
        </section>

        <section className="lg:col-span-2 space-y-4">
          <ResultPanel loading={loading} result={result}/>
          <ModelPanel/>
        </section>
      </main>
    </>
  );
}

function Input({ label, icon: Icon, value, onChange }: any) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center glass rounded-lg px-3 py-2.5 focus-within:ring-1 focus-within:ring-primary/60">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground mr-2"/>}
        <input value={value} onChange={(e)=>onChange(e.target.value)} className="flex-1 bg-transparent text-sm outline-none"/>
      </div>
    </label>
  );
}

function Select({ label, icon: Icon, value, options, onChange }: any) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center glass rounded-lg px-3 py-2.5">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground mr-2"/>}
        <select value={value} onChange={(e)=>onChange(e.target.value)} className="flex-1 bg-transparent text-sm outline-none appearance-none">
          {options.map((o: string) => <option key={o} value={o} className="bg-card">{o}</option>)}
        </select>
      </div>
    </label>
  );
}

function ResultPanel({ loading, result }: { loading: boolean; result: Result | null }) {
  if (loading) {
    return (
      <div className="glass rounded-2xl p-8 text-center relative overflow-hidden h-80 grid place-items-center">
        <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-scan"/>
        <div>
          <div className="mx-auto h-20 w-20 rounded-full bg-gradient-primary grid place-items-center animate-pulse-glow">
            <Cpu className="h-8 w-8 text-primary-foreground"/>
          </div>
          <p className="mt-5 font-display font-semibold">Neural network processing…</p>
          <p className="text-xs text-muted-foreground">Running 6 models in ensemble</p>
        </div>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="glass rounded-2xl p-8 text-center h-80 grid place-items-center">
        <div>
          <ShieldCheck className="h-10 w-10 mx-auto text-primary"/>
          <p className="mt-3 font-display font-semibold">Ready to scan</p>
          <p className="text-xs text-muted-foreground">Fill out the form and run prediction</p>
        </div>
      </div>
    );
  }

  const pct = Math.round(result.proba * 100);
  const fraud = result.fraud;
  return (
    <div className={`glass rounded-2xl p-6 relative overflow-hidden ${fraud ? "ring-1 ring-destructive/50" : "ring-1 ring-success/30"}`}>
      <div className={`absolute inset-0 ${fraud ? "bg-gradient-to-br from-destructive/20 to-transparent" : "bg-gradient-to-br from-success/20 to-transparent"} pointer-events-none`}/>
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Prediction</p>
            <p className={`mt-1 text-2xl font-display font-semibold ${fraud ? "text-destructive" : "text-success"}`}>
              {fraud ? "Fraud detected" : "Transaction safe"}
            </p>
          </div>
          {fraud
            ? <AlertTriangle className="h-8 w-8 text-destructive animate-pulse-glow"/>
            : <ShieldCheck className="h-8 w-8 text-success"/>}
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-xs text-muted-foreground"><span>Fraud probability</span><span>{pct}%</span></div>
          <div className="mt-2 h-3 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full ${pct > 60 ? "bg-destructive" : pct > 30 ? "bg-warning" : "bg-success"}`} style={{ width: `${pct}%` }}/>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 text-center text-xs">
            <Metric label="Confidence" value={`${Math.round(result.confidence*100)}%`}/>
            <Metric label="Risk level" value={result.risk}/>
            <Metric label="Model" value="NN-v4"/>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">AI explanation</p>
          <ul className="space-y-2 text-sm">
            {result.reasons.map(r => (
              <li key={r} className="flex gap-2"><span className={`mt-1.5 h-1.5 w-1.5 rounded-full ${fraud ? "bg-destructive" : "bg-success"}`}/> {r}</li>
            ))}
          </ul>
        </div>

        <div className={`mt-5 rounded-lg p-3 text-sm ${fraud ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
          <span className="font-semibold">Suggested action:</span> {result.action}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-lg p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}

function ModelPanel() {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-sm font-display font-semibold">Ensemble breakdown</p>
      <div className="mt-4 space-y-3">
        {[
          ["Neural Network", 0.91],
          ["Random Forest", 0.84],
          ["SVM", 0.77],
          ["KNN", 0.62],
          ["Logistic Regr.", 0.55],
          ["Decision Tree", 0.49],
        ].map(([n, v]) => (
          <div key={n as string}>
            <div className="flex justify-between text-xs"><span>{n}</span><span className="font-mono text-muted-foreground">{Math.round((v as number)*100)}%</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-gradient-primary" style={{ width: `${(v as number)*100}%` }}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
