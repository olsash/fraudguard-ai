import { Topbar } from "@/components/layout/Topbar";
import { GraduationCap, BookOpen, Users, Calendar, Github } from "lucide-react";

export default function Thesis() {
  return (
    <>
      <Topbar title="Research" subtitle="Bachelor thesis - context, methodology, results"/>
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="glass rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-mesh opacity-60"/>
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs">
              <GraduationCap className="h-3 w-3 text-primary"/> Bachelor Thesis - 2026
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-display font-semibold">
              Credit Card Fraud Detection System using <span className="text-gradient">Machine Learning Techniques</span>
            </h1>
            <p className="mt-4 text-muted-foreground">
              This research investigates the application of supervised machine learning to detect fraudulent credit card
              transactions in real time. We benchmark six algorithms across precision, recall, and F1, and ship a full-stack
              prototype that integrates the best-performing model into a production-style fintech workspace.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Meta icon={Users} label="Author" value="Sara Amrani"/>
              <Meta icon={BookOpen} label="Supervisor" value="Prof. K. El Mansouri"/>
              <Meta icon={Calendar} label="Defense" value="June 2026"/>
              <Meta icon={Github} label="Repo" value="github.com/sentinelai/thesis"/>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Block title="Problem statement" body="Credit card fraud causes over $32B in annual losses worldwide. Traditional rule-based systems cannot keep pace with adversarial behavior; intelligent, adaptive systems are required."/>
          <Block title="Research questions" body="(1) Which ML algorithms perform best on highly imbalanced fraud datasets? (2) How can class imbalance be mitigated? (3) Can the model run in real time within a web environment?"/>
          <Block title="Contributions" body="A comparative study of 6 ML models; a SMOTE + feature-engineering pipeline; a production-grade .NET + React prototype integrating the trained model."/>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Block title="Methodology" body="CRISP-DM phases were followed: data understanding, preparation, modeling, evaluation, deployment. Models were trained with 5-fold CV and grid search on a SMOTE-balanced dataset of 284,807 transactions."/>
          <Block title="Results" body="The Neural Network reached 99.41% accuracy, 98.7% precision and 97.9% recall - outperforming Random Forest (98.92%), SVM (97.65%) and the baseline models. Confusion matrix and ROC curves are available in the AI Models page."/>
        </div>

        <div className="glass rounded-2xl p-6">
          <p className="font-display font-semibold">Tech stack</p>
          <div className="mt-3 grid md:grid-cols-3 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Frontend</p><p>React - TanStack Start - Tailwind v4 - Recharts</p></div>
            <div><p className="text-xs text-muted-foreground">Backend</p><p>ASP.NET Core Web API - JWT auth - MySQL</p></div>
            <div><p className="text-xs text-muted-foreground">Machine Learning</p><p>Python - Pandas - NumPy - Scikit-learn - TensorFlow / Keras</p></div>
          </div>
        </div>
      </main>
    </>
  );
}

function Meta({ icon: Icon, label, value }: any) {
  return (
    <div className="glass rounded-lg px-3 py-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary"/>
      <div><p className="text-[10px] text-muted-foreground">{label}</p><p className="text-xs font-medium">{value}</p></div>
    </div>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="font-display font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground mt-2">{body}</p>
    </div>
  );
}