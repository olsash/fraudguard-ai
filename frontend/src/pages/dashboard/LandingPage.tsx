import { Link } from "@tanstack/react-router";
import { Brand } from "@/components/common/Brand";
import {
  ShieldCheck, Brain, Activity, Zap, Lock, Globe, ArrowRight, CheckCircle2,
  Cpu, LineChart, Radar, Eye, Sparkles, AlertTriangle,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { fraudTrend } from "@/data/mockData";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <LogoStrip />
      <Stats />
      <Features />
      <HowItWorks />
      <ModelsSection />
      <DashboardPreview />
      <Security />
      <Testimonials />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/60 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 h-16">
        <Link to="/"><Brand /></Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">Features</a>
          <a href="#models" className="hover:text-foreground">AI Models</a>
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#security" className="hover:text-foreground">Security</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">Sign in</Link>
          <Link to="/login" className="text-sm bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 font-medium ring-glow hover:opacity-95">
            Launch App
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="absolute inset-0 bg-mesh" />
      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow"/>
            Live - 1.2M transactions analyzed today
          </div>
          <h1 className="mt-5 text-5xl md:text-6xl font-display font-semibold leading-[1.05] tracking-tight">
            Fraud doesn't sleep. <span className="text-gradient">Neither does our AI.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl">
            Trusted by risk teams to score 1.2M+ transactions a day with 99.41% precision.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/app/predict" className="inline-flex items-center gap-2 bg-gradient-primary text-primary-foreground rounded-lg px-5 py-3 font-medium ring-glow">
              Start Analysis <ArrowRight className="h-4 w-4"/>
            </Link>
            <Link to="/app" className="inline-flex items-center gap-2 glass rounded-lg px-5 py-3 font-medium hover:ring-1 hover:ring-primary/40">
              View Dashboard
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
            {[
              ["99.41%", "Detection accuracy"],
              ["12 ms", "Avg. inference time"],
              ["6", "ML algorithms"],
            ].map(([v, l]) => (
              <div key={l}>
                <p className="text-2xl font-display font-semibold text-gradient">{v}</p>
                <p className="text-xs text-muted-foreground mt-1">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <HeroVisual />
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative h-[520px]">
      {/* Orbit rings */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="h-[460px] w-[460px] rounded-full border border-primary/15 animate-[spin_30s_linear_infinite]" />
        <div className="absolute h-[340px] w-[340px] rounded-full border border-accent/20 animate-[spin_20s_linear_infinite_reverse]" />
        <div className="absolute h-[220px] w-[220px] rounded-full border border-primary/30" />
      </div>
      {/* Core shield */}
      <div className="absolute inset-0 grid place-items-center">
        <div className="relative h-32 w-32 rounded-3xl bg-gradient-primary grid place-items-center ring-glow animate-float">
          <ShieldCheck className="h-14 w-14 text-primary-foreground" strokeWidth={2}/>
          <div className="absolute inset-0 rounded-3xl overflow-hidden">
            <div className="h-full w-full animate-scan bg-gradient-to-b from-transparent via-white/40 to-transparent"/>
          </div>
        </div>
      </div>
      {/* Floating cards */}
      <FloatCard className="top-4 left-2" delay="0s">
        <Brain className="h-4 w-4 text-primary"/>
        <div>
          <p className="text-xs text-muted-foreground">Neural Net</p>
          <p className="text-sm font-semibold">99.41% acc.</p>
        </div>
      </FloatCard>
      <FloatCard className="top-16 right-0" delay="1s">
        <AlertTriangle className="h-4 w-4 text-destructive"/>
        <div>
          <p className="text-xs text-muted-foreground">Fraud flagged</p>
              <p className="text-sm font-semibold">TX-9F2A - $3,420</p>
        </div>
      </FloatCard>
      <FloatCard className="bottom-20 left-0" delay="2s">
        <Activity className="h-4 w-4 text-success"/>
        <div>
          <p className="text-xs text-muted-foreground">Stream</p>
          <p className="text-sm font-semibold">1,248 tx/sec</p>
        </div>
      </FloatCard>
      <FloatCard className="bottom-4 right-4" delay="1.5s">
        <Radar className="h-4 w-4 text-accent"/>
        <div>
          <p className="text-xs text-muted-foreground">Risk score</p>
          <p className="text-sm font-semibold">Low - 14</p>
        </div>
      </FloatCard>
    </div>
  );
}

function FloatCard({ children, className = "", delay = "0s" }: any) {
  return (
    <div
      className={`absolute glass rounded-xl p-3 flex items-center gap-3 min-w-[170px] animate-float ${className}`}
      style={{ animationDelay: delay }}
    >
      {children}
    </div>
  );
}

function LogoStrip() {
  return (
    <div className="border-y border-border bg-card/30">
      <div className="mx-auto max-w-7xl px-6 py-8 flex flex-wrap items-center justify-between gap-6 opacity-70">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Trusted by leading fintech teams</p>
        {["NORDBANK", "PAYWAVE", "AXISFIN", "VOLT.PAY", "ZENITH", "CRYPTOLEDGER"].map(n => (
          <span key={n} className="text-sm font-display tracking-wider text-muted-foreground">{n}</span>
        ))}
      </div>
    </div>
  );
}

function Stats() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { v: "184k", l: "Transactions / day", icon: Activity },
          { v: "1,247", l: "Frauds blocked / mo", icon: ShieldCheck },
          { v: "$4.2M", l: "Loss prevented", icon: LineChart },
          { v: "98%", l: "Customer trust", icon: CheckCircle2 },
        ].map((s, i) => (
          <div key={i} className="glass rounded-2xl p-6">
            <s.icon className="h-5 w-5 text-primary"/>
            <p className="mt-4 text-3xl font-display font-semibold">{s.v}</p>
            <p className="text-sm text-muted-foreground">{s.l}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Live fraud activity</p>
            <p className="text-lg font-display font-semibold">Real-time detection signal</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-success">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow"/> Streaming
          </div>
        </div>
        <div className="h-44">
          <ResponsiveContainer>
            <AreaChart data={fraudTrend}>
              <defs>
                <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0.6}/>
                  <stop offset="100%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.66 0.24 25)" stopOpacity={0.6}/>
                  <stop offset="100%" stopColor="oklch(0.66 0.24 25)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip contentStyle={{ background: "oklch(0.21 0.03 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8 }}/>
              <Area type="monotone" dataKey="safe" stroke="oklch(0.78 0.18 200)" fill="url(#g1)" strokeWidth={2}/>
              <Area type="monotone" dataKey="fraud" stroke="oklch(0.66 0.24 25)" fill="url(#g2)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Brain, title: "Neural Network Engine", desc: "Deep-learning model trained on 280k+ labeled transactions for unmatched precision." },
    { icon: Zap, title: "12 ms inference", desc: "Score every transaction in real-time without slowing down checkout." },
    { icon: Eye, title: "Explainable AI", desc: "SHAP-based reasoning for every prediction - not a black box." },
    { icon: Globe, title: "Geo-velocity analytics", desc: "Detect impossible travel and cross-border anomalies instantly." },
    { icon: Lock, title: "PCI-DSS aligned", desc: "Tokenized inputs, encrypted at rest, audited every quarter." },
    { icon: Cpu, title: "6 Model ensemble", desc: "LR, DT, RF, SVM, KNN, NN - automatically routed for best precision." },
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="Capabilities" title="Everything a fraud team needs" />
      <div className="grid md:grid-cols-3 gap-4 mt-10">
        {items.map((it) => (
          <div key={it.title} className="glass rounded-2xl p-6 group hover:ring-1 hover:ring-primary/40 transition">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center ring-glow">
              <it.icon className="h-5 w-5 text-primary-foreground"/>
            </div>
            <h3 className="mt-4 text-lg font-display font-semibold">{it.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "Ingest", d: "Stream transactions from your payment processor or batch API." },
    { n: "02", t: "Enrich", d: "Append geo, device, merchant and behavioral features." },
    { n: "03", t: "Score", d: "Run through the ensemble - get probability, confidence, reason codes." },
    { n: "04", t: "Act", d: "Allow, challenge or block - with an audit trail your auditors will love." },
  ];
  return (
    <section id="how" className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="Pipeline" title="From swipe to decision in under 20ms" />
      <div className="grid md:grid-cols-4 gap-4 mt-10">
        {steps.map((s, i) => (
          <div key={s.n} className="relative glass rounded-2xl p-6">
            <p className="text-xs font-mono text-primary">{s.n}</p>
            <h3 className="mt-2 text-lg font-display font-semibold">{s.t}</h3>
            <p className="text-sm text-muted-foreground mt-2">{s.d}</p>
            {i < steps.length - 1 && <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary/60"/>}
          </div>
        ))}
      </div>
    </section>
  );
}

function ModelsSection() {
  const m = [
    ["Neural Network", "99.41%", "Best overall"],
    ["Random Forest", "98.92%", "Fastest ensemble"],
    ["SVM", "97.65%", "Strong margin"],
    ["Logistic Regr.", "95.21%", "Interpretable"],
    ["Decision Tree", "94.78%", "Explainable"],
    ["KNN", "93.12%", "Baseline"],
  ];
  return (
    <section id="models" className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="Machine Learning" title="Six battle-tested algorithms, one decision engine" />
      <div className="mt-10 grid md:grid-cols-3 gap-4">
        {m.map(([name, acc, tag]) => (
          <div key={name} className="glass rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl"/>
            <p className="text-xs text-muted-foreground">{tag}</p>
            <p className="text-xl font-display font-semibold mt-1">{name}</p>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-3xl font-display text-gradient">{acc}</span>
              <Brain className="h-6 w-6 text-primary/60"/>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-gradient-primary" style={{ width: acc }}/>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardPreview() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="Workspace" title="A control center built for fraud analysts" />
      <div className="mt-10 glass-strong rounded-3xl p-3 ring-1 ring-primary/20">
        <div className="rounded-2xl bg-card/80 grid-bg p-6 min-h-[420px] relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent"/>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              ["Total Transactions", "184,392", "+12.4%"],
              ["Fraud Detected", "1,247", "-8.1%"],
              ["Risk Score", "23 / 100", "Stable"],
            ].map(([l, v, d]) => (
              <div key={l} className="glass rounded-xl p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{l}</p>
                <p className="text-2xl font-display font-semibold mt-1">{v}</p>
                <p className="text-xs text-primary mt-1">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 glass rounded-xl p-4 h-56">
            <ResponsiveContainer>
              <AreaChart data={fraudTrend}>
                <defs>
                  <linearGradient id="gp" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.65 0.22 285)" stopOpacity={0.7}/>
                    <stop offset="100%" stopColor="oklch(0.65 0.22 285)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="safe" stroke="oklch(0.65 0.22 285)" fill="url(#gp)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section id="security" className="mx-auto max-w-7xl px-6 py-20">
      <div className="glass rounded-3xl p-10 grid md:grid-cols-2 gap-10 items-center relative overflow-hidden">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-accent/30 blur-3xl"/>
        <div className="relative">
          <Lock className="h-8 w-8 text-primary"/>
          <h2 className="mt-4 text-3xl md:text-4xl font-display font-semibold">Security is not a feature. It's the foundation.</h2>
          <p className="mt-3 text-muted-foreground">End-to-end encryption, role-based access, signed audit trails and zero-trust networking. Every decision is reproducible.</p>
        </div>
        <ul className="relative space-y-3 text-sm">
          {["PCI-DSS Level 1 aligned","SOC 2 Type II controls","ISO 27001 ready","GDPR & CCPA compliant","99.99% uptime SLA","Encrypted model weights"].map(i => (
            <li key={i} className="flex items-center gap-3 glass rounded-lg p-3"><CheckCircle2 className="h-4 w-4 text-success"/> {i}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Testimonials() {
  const t = [
    { q: "FraudGuard cut our chargeback rate by 71% in three months.", a: "Maya Lindgren", r: "Head of Risk, NORDBANK" },
    { q: "The explainability dashboards turned every dispute into a 30-second resolution.", a: "Joshua Park", r: "Fraud Lead, PAYWAVE" },
    { q: "Our analysts finally trust the model - and the model trusts the data.", a: "Amani Diallo", r: "VP Engineering, VOLT.PAY" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="Customers" title="Loved by risk teams worldwide" />
      <div className="grid md:grid-cols-3 gap-4 mt-10">
        {t.map((x) => (
          <div key={x.a} className="glass rounded-2xl p-6">
            <Sparkles className="h-5 w-5 text-primary"/>
            <p className="mt-4 text-base">"{x.q}"</p>
            <div className="mt-6">
            <p className="text-sm font-semibold">{x.a}, {x.r}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 text-center ring-glow">
        <div className="absolute inset-0 grid-bg opacity-30"/>
        <div className="relative">
          <h2 className="text-3xl md:text-5xl font-display font-semibold text-primary-foreground">Catch fraud before it costs you.</h2>
          <p className="mt-4 text-primary-foreground/80 max-w-2xl mx-auto">Launch the demo workspace - explore live transactions, run AI predictions, and walk through every model side by side.</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link to="/app" className="bg-background text-foreground rounded-lg px-5 py-3 font-medium hover:bg-background/90">Open Dashboard</Link>
            <Link to="/app/predict" className="glass-strong rounded-lg px-5 py-3 font-medium text-primary-foreground border border-white/30">Try AI Detection</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border mt-10">
      <div className="mx-auto max-w-7xl px-6 py-12 grid md:grid-cols-4 gap-8">
        <div>
          <Brand/>
          <p className="text-sm text-muted-foreground mt-3">AI-powered fraud detection for modern fintech. Built as a research thesis project.</p>
        </div>
        {[
          ["Product", ["Dashboard", "AI Detection", "Reports", "Pricing"]],
          ["Research", ["ML Pipeline", "Model Performance", "Thesis", "Datasets"]],
          ["Company", ["About", "Contact", "Security", "Privacy"]],
        ].map(([title, items]) => (
          <div key={title as string}>
            <p className="text-sm font-semibold">{title}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {(items as string[]).map(i => <li key={i}><a href="#" className="hover:text-foreground">{i}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-4 flex justify-between text-xs text-muted-foreground">
          <p>(c) 2026 FraudGuard - Bachelor thesis research project</p>
          <p>Built with React, ASP.NET Core, MySQL, scikit-learn & TensorFlow</p>
        </div>
      </div>
    </footer>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.25em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 text-3xl md:text-4xl font-display font-semibold">{title}</h2>
    </div>
  );
}
