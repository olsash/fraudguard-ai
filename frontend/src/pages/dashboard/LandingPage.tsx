import { Link } from "@tanstack/react-router";
import { Brand } from "@/components/common/Brand";
import { authService, type AuthRole } from "@/services/authService";
import {
  ShieldCheck, Brain, Activity, Zap, Lock, Globe, ArrowRight, CheckCircle2,
  Cpu, LineChart, Radar, Eye, Sparkles, AlertTriangle,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { models as modelMetrics } from "@/data/fraudVisualizationData";
import { useEffect, useState } from "react";

const sampleTrend = [
  { day: "Mon", safe: 42, fraud: 3 },
  { day: "Tue", safe: 58, fraud: 7 },
  { day: "Wed", safe: 51, fraud: 5 },
  { day: "Thu", safe: 64, fraud: 9 },
  { day: "Fri", safe: 72, fraud: 6 },
  { day: "Sat", safe: 46, fraud: 4 },
  { day: "Sun", safe: 55, fraud: 8 },
];

export default function Landing() {
  const [role, setRole] = useState<AuthRole | null>(null);

  useEffect(() => {
    setRole(authService.getCurrentRole());
  }, []);

  return (
    <div className="min-h-screen">
      <Nav role={role} />
      <Hero role={role} />
      <LogoStrip />
      <Stats />
      <Features />
      <HowItWorks />
      <ModelsSection />
      <DashboardPreview />
      <Security />
      <Testimonials />
      <CTA role={role} />
      <Footer />
    </div>
  );
}

function WorkspaceLink({
  role,
  className,
  children,
}: {
  role: AuthRole | null;
  className: string;
  children: React.ReactNode;
}) {
  if (role === "admin") {
    return <Link to="/admin" className={className}>{children}</Link>;
  }

  if (role === "user") {
    return <Link to="/app" className={className}>{children}</Link>;
  }

  return <Link to="/login" className={className}>{children}</Link>;
}

function Nav({ role }: { role: AuthRole | null }) {
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
          <WorkspaceLink role={role} className="text-sm bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 font-medium ring-glow hover:opacity-95">
            Launch App
          </WorkspaceLink>
        </div>
      </div>
    </header>
  );
}

function Hero({ role }: { role: AuthRole | null }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="absolute inset-0 bg-mesh" />
      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow"/>
            FraudGuard-AI research and prediction workspace
          </div>
          <h1 className="mt-5 text-5xl md:text-6xl font-display font-semibold leading-[1.05] tracking-tight">
            Online payment fraud detection with <span className="text-gradient">machine learning.</span>
          </h1>
          <p className="mt-5 text-lg text-muted-foreground max-w-xl">
            Detect suspicious online payment transactions using machine learning. Analyze risk, review alerts, export reports, and compare trained scikit-learn models.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            {role ? (
              <WorkspaceLink role={role} className="inline-flex items-center gap-2 bg-gradient-primary text-primary-foreground rounded-lg px-5 py-3 font-medium ring-glow">
                Open Workspace <ArrowRight className="h-4 w-4"/>
              </WorkspaceLink>
            ) : (
              <Link to="/register" className="inline-flex items-center gap-2 bg-gradient-primary text-primary-foreground rounded-lg px-5 py-3 font-medium ring-glow">
                Create Account <ArrowRight className="h-4 w-4"/>
              </Link>
            )}
            <Link to="/login" className="inline-flex items-center gap-2 glass rounded-lg px-5 py-3 font-medium hover:ring-1 hover:ring-primary/40">
              Sign in
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
            {[
              ["5", "Classifiers"],
              ["JWT", "Role access"],
              ["FastAPI", "ML service"],
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
          <p className="text-xs text-muted-foreground">MLPClassifier</p>
          <p className="text-sm font-semibold">scikit-learn</p>
        </div>
      </FloatCard>
      <FloatCard className="top-16 right-0" delay="1s">
        <AlertTriangle className="h-4 w-4 text-destructive"/>
        <div>
          <p className="text-xs text-muted-foreground">Example alert</p>
          <p className="text-sm font-semibold">High-risk transfer</p>
        </div>
      </FloatCard>
      <FloatCard className="bottom-20 left-0" delay="2s">
        <Activity className="h-4 w-4 text-success"/>
        <div>
          <p className="text-xs text-muted-foreground">Workflow</p>
          <p className="text-sm font-semibold">Prediction history</p>
        </div>
      </FloatCard>
      <FloatCard className="bottom-4 right-4" delay="1.5s">
        <Radar className="h-4 w-4 text-accent"/>
        <div>
          <p className="text-xs text-muted-foreground">Example score</p>
          <p className="text-sm font-semibold">Low risk - 14</p>
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
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Implemented FraudGuard-AI modules</p>
        {["AUTH", "PREDICTION", "ALERTS", "REPORTS", "ADMIN", "ML API"].map(n => (
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
          { v: "5", l: "Classification models", icon: Activity },
          { v: "1", l: "FastAPI ML service", icon: ShieldCheck },
          { v: "2", l: "PCA cluster plots", icon: LineChart },
          { v: "Admin", l: "Review dashboard", icon: CheckCircle2 },
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
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Report visualization</p>
            <p className="text-lg font-display font-semibold">Fraud and transaction trend signal</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-success">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow"/> Sample visualization
          </div>
        </div>
        <div className="h-44">
          <ResponsiveContainer>
            <AreaChart data={sampleTrend}>
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
    { icon: Brain, title: "Model comparison", desc: "Compare Logistic Regression, KNN, Decision Tree, Random Forest, and MLPClassifier results." },
    { icon: Zap, title: "Prediction workflow", desc: "Submit transaction attributes to the backend and ML API for fraud-risk scoring." },
    { icon: Eye, title: "Evaluation reports", desc: "Review accuracy, precision, recall, F1-score, ROC-AUC, feature importance, and confusion matrices." },
    { icon: Globe, title: "Transaction context", desc: "Use transaction type, amount, and origin/destination balance movements as fraud detection signals." },
    { icon: Lock, title: "Authenticated access", desc: "JWT-protected user and admin workflows separate normal prediction use from review operations." },
    { icon: Cpu, title: "Exploratory clustering", desc: "KMeans and PCA exports are available for analysis, but supervised classifiers remain the fraud prediction path." },
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="Capabilities" title="Implemented FraudGuard-AI workflows" />
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
    { n: "01", t: "Create", d: "Users enter or store transaction details in the ASP.NET Core application." },
    { n: "02", t: "Predict", d: "The backend calls the Python FastAPI ML service with encoded transaction features." },
    { n: "03", t: "Review", d: "Users and admins inspect prediction history, fraud probability, and transaction status." },
    { n: "04", t: "Report", d: "Dashboards and admin pages display alerts, model comparison, and visualization exports." },
  ];
  return (
    <section id="how" className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="Pipeline" title="From transaction details to fraud review" />
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
  return (
    <section id="models" className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="Machine Learning" title="Exported classifier comparison" />
      <div className="mt-10 grid md:grid-cols-3 gap-4">
        {modelMetrics.map((model) => (
          <div key={model.name} className="glass rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl"/>
            <p className="text-xs text-muted-foreground">{model.best ? "Selected model" : model.speed}</p>
            <p className="text-xl font-display font-semibold mt-1">{model.name}</p>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-3xl font-display text-gradient">{model.f1.toFixed(2)} F1</span>
              <Brain className="h-6 w-6 text-primary/60"/>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Precision {model.prec.toFixed(2)}% · Recall {model.rec.toFixed(2)}%
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-gradient-primary" style={{ width: `${Math.min(model.f1, 100)}%` }}/>
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
              ["User workspace", "Transactions", "History and saved records"],
              ["Prediction flow", "Risk scoring", "ML service backed"],
              ["Admin review", "Alerts & logs", "Role-protected pages"],
            ].map(([l, v, d]) => (
              <div key={l} className="glass rounded-xl p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{l}</p>
                <p className="text-2xl font-display font-semibold mt-1">{v}</p>
                <p className="text-xs text-primary mt-1">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 glass rounded-xl p-4 h-56">
            <p className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Sample safe/fraud trend preview</p>
            <ResponsiveContainer>
              <AreaChart data={sampleTrend}>
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
          <h2 className="mt-4 text-3xl md:text-4xl font-display font-semibold">Application controls for review workflows.</h2>
          <p className="mt-3 text-muted-foreground">FraudGuard-AI uses JWT authentication, role-based admin routes, system logs, and stored prediction history to make review activity traceable inside the project application.</p>
        </div>
        <ul className="relative space-y-3 text-sm">
          {["JWT-protected API endpoints","Admin-only review routes","Prediction history records","Fraud alert workflows","System activity logs","Versioned ML result exports"].map(i => (
            <li key={i} className="flex items-center gap-3 glass rounded-lg p-3"><CheckCircle2 className="h-4 w-4 text-success"/> {i}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Testimonials() {
  const t = [
    { q: "The backend exposes authenticated routes for predictions, transactions, alerts, reports, and admin review.", a: "ASP.NET Core", r: "Web API" },
    { q: "The ML service loads trained scikit-learn artifacts and returns fraud predictions for transaction features.", a: "Python", r: "FastAPI" },
    { q: "The frontend provides user dashboards, prediction forms, history, reports, alerts, and admin model comparison.", a: "React", r: "Vite" },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="System" title="Implemented FraudGuard-AI components" />
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

function CTA({ role }: { role: AuthRole | null }) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-primary p-12 text-center ring-glow">
        <div className="absolute inset-0 grid-bg opacity-30"/>
        <div className="relative">
          <h2 className="text-3xl md:text-5xl font-display font-semibold text-primary-foreground">Open the FraudGuard-AI workspace.</h2>
          <p className="mt-4 text-primary-foreground/80 max-w-2xl mx-auto">Explore transaction prediction, prediction history, reports, alerts, and the exported machine learning model comparison.</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            {role ? (
              <WorkspaceLink role={role} className="bg-background text-foreground rounded-lg px-5 py-3 font-medium hover:bg-background/90">
                Open Dashboard
              </WorkspaceLink>
            ) : (
              <Link to="/register" className="bg-background text-foreground rounded-lg px-5 py-3 font-medium hover:bg-background/90">Create Account</Link>
            )}
            <Link to="/login" className="glass-strong rounded-lg px-5 py-3 font-medium text-primary-foreground border border-white/30">Sign in</Link>
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
          <p className="text-sm text-muted-foreground mt-3">Online payment fraud detection using machine learning. Built as a full-stack academic project.</p>
        </div>
        <div>
          <p className="text-sm font-semibold">Workspace</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/app" className="hover:text-foreground">User dashboard</Link></li>
            <li><Link to="/app/predict" className="hover:text-foreground">Fraud prediction</Link></li>
            <li><Link to="/app/transactions" className="hover:text-foreground">Transaction history</Link></li>
            <li><Link to="/app/alerts" className="hover:text-foreground">Alerts</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Admin & ML</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link to="/admin" className="hover:text-foreground">Admin dashboard</Link></li>
            <li><Link to="/admin/models" className="hover:text-foreground">AI models</Link></li>
            <li><Link to="/admin/model-comparison" className="hover:text-foreground">Model comparison</Link></li>
            <li><Link to="/app/pipeline" className="hover:text-foreground">ML pipeline</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold">Project</p>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><a href="#features" className="hover:text-foreground">Features</a></li>
            <li><a href="#models" className="hover:text-foreground">Model metrics</a></li>
            <li><a href="#how" className="hover:text-foreground">Prediction pipeline</a></li>
            <li><a href="#security" className="hover:text-foreground">Security model</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-4 flex justify-between text-xs text-muted-foreground">
          <p>(c) 2026 FraudGuard-AI - academic machine learning project</p>
          <p>Built with React/Vite, ASP.NET Core Web API, SQL Server, FastAPI, and scikit-learn</p>
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
