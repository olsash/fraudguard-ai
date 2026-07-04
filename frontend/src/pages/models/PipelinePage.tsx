import { Topbar } from "@/components/layout/Topbar";
import {
  Database, Sparkles, Wrench, Layers, Brain, GaugeCircle, Send, Globe, ArrowDown,
} from "lucide-react";

const steps = [
  {
    icon: Database,
    title: "Dataset",
    desc: "Fraud transaction dataset loaded from ml/dataset/fraud.csv with transaction type, amount, origin/destination balances, and isFraud label.",
    stat: "fraud.csv",
  },
  {
    icon: Sparkles,
    title: "Data Cleaning",
    desc: "Validated required columns, removed incomplete modeling rows, and checked class distribution before training.",
    stat: "validated",
  },
  {
    icon: Wrench,
    title: "Preprocessing",
    desc: "One-hot encoded transaction type and scaled numeric features inside pipelines for LR, KNN, MLP, KMeans, and PCA.",
    stat: "encoded",
  },
  {
    icon: Layers,
    title: "Feature Selection",
    desc: "Ranked encoded transaction features with SelectKBest and compared the selected subset against the full feature set.",
    stat: "SelectKBest",
  },
  {
    icon: Brain,
    title: "Model Training",
    desc: "Trained Logistic Regression, KNN, Decision Tree, Random Forest, and Neural Network / MLPClassifier with GridSearchCV.",
    stat: "5 models",
  },
  {
    icon: GaugeCircle,
    title: "Evaluation",
    desc: "Compared accuracy, precision, recall, F1-score, ROC-AUC, confusion matrices, and exported app-compatible result files.",
    stat: "F1 + AUC",
  },
  {
    icon: Send,
    title: "Prediction API",
    desc: "Best model artifacts are exported to ONNX and served directly by the ASP.NET Core Web API.",
    stat: "ONNX",
  },
  {
    icon: Globe,
    title: "Web Integration",
    desc: "React/Vite pages support fraud prediction, prediction history, reports, alerts, admin review, and model comparison.",
    stat: "React/Vite",
  },
];

export default function Pipeline() {
  return (
    <>
      <Topbar title="Machine Learning Pipeline" subtitle="End-to-end workflow - from raw dataset to production prediction"/>
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {[ 
            ["Dataset", "fraud.csv"], ["Target", "isFraud"],
            ["Classifiers", "5"], ["Clustering", "KMeans"],
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
            {["Python","Pandas","NumPy","scikit-learn","MLPClassifier","KMeans","PCA","ONNX Runtime","ASP.NET Core","SQL Server","React","Vite"].map(t => (
              <span key={t} className="glass rounded-lg px-3 py-1.5 text-sm">{t}</span>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
