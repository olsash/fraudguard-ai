import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/topbar";
import { models, rocData } from "@/lib/mock-data";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { Trophy, Brain, Zap, Clock } from "lucide-react";

export const Route = createFileRoute("/_app/app/models")({
  component: ModelsPage,
});

const tooltipStyle = { background: "oklch(0.21 0.03 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8, fontSize: 12 };
const axis = { fontSize: 11, fill: "oklch(0.68 0.03 250)" };

function ModelsPage() {
  const best = models[0];
  return (
    <>
      <Topbar title="AI Model Performance" subtitle="Six machine learning algorithms benchmarked on 280k transactions"/>
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="glass rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-accent/10"/>
          <div className="relative grid md:grid-cols-4 gap-6 items-center">
            <div className="md:col-span-2">
              <div className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs">
                <Trophy className="h-3 w-3 text-warning"/> Best performing model
              </div>
              <h2 className="mt-3 text-3xl font-display font-semibold">{best.name}</h2>
              <p className="text-sm text-muted-foreground mt-2">A 4-layer feed-forward network with dropout regularization, trained for 50 epochs on a balanced SMOTE-resampled dataset.</p>
            </div>
            <Stat label="Accuracy" value={`${best.acc}%`} icon={Brain}/>
            <Stat label="Inference" value={best.speed} icon={Zap}/>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          {models.map(m => (
            <div key={m.name} className={`glass rounded-2xl p-5 relative ${m.best ? "ring-1 ring-primary/50" : ""}`}>
              {m.best && <span className="absolute top-3 right-3 text-[10px] bg-primary text-primary-foreground rounded-full px-2 py-0.5">BEST</span>}
              <p className="text-xs text-muted-foreground">Algorithm</p>
              <p className="text-lg font-display font-semibold">{m.name}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <Mini label="Accuracy" value={`${m.acc}%`}/>
                <Mini label="Precision" value={`${m.prec}%`}/>
                <Mini label="Recall" value={`${m.rec}%`}/>
                <Mini label="F1" value={`${m.f1}%`}/>
              </div>
              <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3"/>{m.time}</span>
                <span>{m.speed} / pred</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5 h-96">
            <p className="font-display font-semibold">ROC Curves</p>
            <p className="text-xs text-muted-foreground mb-4">True positive rate vs false positive rate</p>
            <ResponsiveContainer>
              <LineChart data={rocData}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)"/>
                <XAxis dataKey="fpr" tick={axis} axisLine={false} tickLine={false} label={{ value: "FPR", position: "insideBottom", offset: -5, fontSize: 10, fill: "oklch(0.68 0.03 250)" }}/>
                <YAxis tick={axis} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <ReferenceLine segment={[{x:0,y:0},{x:1,y:1}]} stroke="oklch(1 0 0 / 0.2)" strokeDasharray="3 3"/>
                <Line type="monotone" dataKey="nn" stroke="oklch(0.78 0.18 200)" strokeWidth={2} dot={false} name="Neural Net"/>
                <Line type="monotone" dataKey="rf" stroke="oklch(0.65 0.22 285)" strokeWidth={2} dot={false} name="Random Forest"/>
                <Line type="monotone" dataKey="svm" stroke="oklch(0.72 0.18 155)" strokeWidth={2} dot={false} name="SVM"/>
                <Line type="monotone" dataKey="lr" stroke="oklch(0.8 0.17 75)" strokeWidth={2} dot={false} name="Logistic Reg."/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="glass rounded-2xl p-5 h-96">
            <p className="font-display font-semibold">Multi-metric comparison</p>
            <p className="text-xs text-muted-foreground mb-4">Across precision, recall, F1, and accuracy</p>
            <ResponsiveContainer>
              <RadarChart data={models.map(m => ({ metric: m.name, acc: m.acc, prec: m.prec, rec: m.rec, f1: m.f1 }))}>
                <PolarGrid stroke="oklch(1 0 0 / 0.1)"/>
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "oklch(0.68 0.03 250)" }}/>
                <PolarRadiusAxis tick={{ fontSize: 9, fill: "oklch(0.5 0.02 250)" }} domain={[80,100]}/>
                <Radar dataKey="acc" stroke="oklch(0.78 0.18 200)" fill="oklch(0.78 0.18 200)" fillOpacity={0.3}/>
                <Radar dataKey="f1" stroke="oklch(0.65 0.22 285)" fill="oklch(0.65 0.22 285)" fillOpacity={0.2}/>
                <Tooltip contentStyle={tooltipStyle}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <ConfusionMatrix/>
      </main>
    </>
  );
}

function Stat({ label, value, icon: Icon }: any) {
  return (
    <div className="glass rounded-xl p-4">
      <Icon className="h-4 w-4 text-primary"/>
      <p className="text-xs text-muted-foreground mt-2">{label}</p>
      <p className="text-2xl font-display font-semibold mt-1">{value}</p>
    </div>
  );
}

function Mini({ label, value }: any) {
  return (
    <div className="glass rounded-md p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ConfusionMatrix() {
  const m = [[27412, 188], [142, 2258]];
  const labels = ["Safe", "Fraud"];
  const max = 27412;
  return (
    <div className="glass rounded-2xl p-5">
      <p className="font-display font-semibold">Confusion Matrix · Neural Network</p>
      <p className="text-xs text-muted-foreground mb-4">On 30,000 hold-out transactions</p>
      <div className="inline-grid grid-cols-[80px_repeat(2,minmax(120px,1fr))] gap-2">
        <div/>
        {labels.map(l => <div key={l} className="text-xs text-center text-muted-foreground">Pred: {l}</div>)}
        {m.map((row, i) => (
          <>
            <div key={`l${i}`} className="text-xs text-muted-foreground self-center">Actual: {labels[i]}</div>
            {row.map((v, j) => {
              const correct = i === j;
              const intensity = v / max;
              return (
                <div key={`${i}-${j}`}
                  className="rounded-lg p-4 text-center font-display"
                  style={{
                    background: `color-mix(in oklab, ${correct ? "oklch(0.72 0.18 155)" : "oklch(0.66 0.24 25)"} ${intensity * 60 + 15}%, transparent)`,
                  }}>
                  <p className="text-xs text-muted-foreground">{correct ? "True" : "False"} {i===j ? labels[i] : labels[j]}</p>
                  <p className="text-xl font-semibold mt-1">{v.toLocaleString()}</p>
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
