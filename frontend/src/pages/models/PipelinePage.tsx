import { Topbar } from "@/components/layout/Topbar";
import {
  Database, Sparkles, Wrench, Layers, Brain, GaugeCircle, Send, Globe, ArrowDown,
} from "lucide-react";

const steps = [
  {
    icon: Database,
    title: "Dataset",
    desc: "284,807 transactions - 492 fraudulent (0.172%). Kaggle Credit Card dataset + simulated stream.",
    stat: "284,807 rows",
  },
  {
    icon: Sparkles,
    title: "Data Cleaning",
    desc: "Removed duplicates, handled missing values, fixed type inconsistencies and outliers via IQR capping.",
    stat: "0 NaN",
  },
  {
    icon: Wrench,
    title: "Preprocessing",
    desc: "StandardScaler on Amount & Time, one-hot encoded categoricals, SMOTE oversampling on minority class.",
    stat: "SMOTE 1:1",
  },
  {
    icon: Layers,
    title: "Feature Engineering",
    desc: "Created velocity features, geo distance, time-of-day risk, merchant frequency, behavioral drift score.",
    stat: "31 features",
  },
  {
    icon: Brain,
    title: "Model Training",
    desc: "Trained 6 algorithms (LR, DT, RF, SVM, KNN, NN) with 5-fold cross-validation and grid search.",
    stat: "6 models",
  },
  {
    icon: GaugeCircle,
    title: "Evaluation",
    desc: "Compared accuracy, precision, recall, F1, ROC-AUC and confusion matrices on 30k hold-out set.",
    stat: "AUC 0.998",
  },
  {
    icon: Send,
    title: "Prediction API",
    desc: "Best model exported as ONNX, served via ASP.NET Core Web API with 12ms median latency.",
    stat: "12 ms p50",
  },
  {
    icon: Globe,
    title: "Web Integration",
    desc: "React dashboard consumes API in real time, displaying decisions, explanations and audit trails.",
    stat: "Live",
  },
];

export default function Pipeline() {
  return (
    <>
      <Topbar title="Machine Learning Pipeline" subtitle="End-to-end workflow - from raw dataset to production prediction"/>
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {[
            ["Dataset size", "284,807"], ["Fraud ratio", "0.172%"],
            ["Features engineered", "31"], ["Best AUC", "0.998"],
          ].map(([l, v]) => (
            <div key={l} className="glass rounded-2xl p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{l}</p>
              <p className="mt-2 text-2xl font-display font-semibold text-gradient">{v}</p>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={s.title} className="relative">
              <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-5 hover:ring-1 hover:ring-primary/40 transition">
                <div className="h-14 w-14 rounded-2xl bg-gradient-primary grid place-items-center ring-glow shrink-0">
                  <s.icon className="h-7 w-7 text-primary-foreground"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-primary">STEP {String(i+1).padStart(2,"0")}</span>
                    <h3 className="text-lg font-display font-semibold">{s.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                </div>
                <div className="glass rounded-lg px-4 py-2 text-sm font-mono">{s.stat}</div>
              </div>
              {i < steps.length - 1 && (
                <div className="flex justify-center my-1">
                  <ArrowDown className="h-5 w-5 text-primary/60"/>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="glass rounded-2xl p-6">
          <p className="font-display font-semibold">Tooling</p>
          <p className="text-xs text-muted-foreground mb-4">Technologies used across the ML and engineering stack</p>
          <div className="flex flex-wrap gap-2">
            {["Python","Pandas","NumPy","Scikit-learn","TensorFlow","Keras","SMOTE","ONNX","ASP.NET Core","MySQL","React","TanStack Start"].map(t => (
              <span key={t} className="glass rounded-lg px-3 py-1.5 text-sm">{t}</span>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
