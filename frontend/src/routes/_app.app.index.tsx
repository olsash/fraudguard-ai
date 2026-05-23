import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/topbar";
import { StatCard } from "@/components/stat-card";
import {
  Activity, ShieldCheck, AlertTriangle, Gauge, Brain, Receipt,
} from "lucide-react";
import { KPI, fraudTrend, volumeData, riskDistribution, hourlyActivity, transactions } from "@/lib/mock-data";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/app/")({
  component: Dashboard,
});

const axis = { fontSize: 11, fill: "oklch(0.68 0.03 250)" };
const tooltipStyle = { background: "oklch(0.21 0.03 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8, fontSize: 12 };

function Dashboard() {
  return (
    <>
      <Topbar title="Dashboard" subtitle="Live overview of your fraud detection workspace"/>
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard label="Total transactions" value={KPI.totalTx.toLocaleString()} delta={12.4} icon={Receipt}/>
          <StatCard label="Fraud detected" value={KPI.fraudDetected.toLocaleString()} delta={-8.1} icon={AlertTriangle} tone="destructive"/>
          <StatCard label="Safe transactions" value={KPI.safeTx.toLocaleString()} delta={13.2} icon={ShieldCheck} tone="success"/>
          <StatCard label="Risk score" value={`${KPI.riskScore}/100`} delta={-3.4} icon={Gauge} tone="warning"/>
          <StatCard label="AI accuracy" value={`${KPI.accuracy}%`} delta={0.3} icon={Brain} tone="violet"/>
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          <Card title="Fraud trends" sub="Last 14 days" className="lg:col-span-2 h-80">
            <ResponsiveContainer>
              <AreaChart data={fraudTrend}>
                <defs>
                  <linearGradient id="aSafe" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0.5}/>
                    <stop offset="100%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="aFraud" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.66 0.24 25)" stopOpacity={0.6}/>
                    <stop offset="100%" stopColor="oklch(0.66 0.24 25)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)"/>
                <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false}/>
                <YAxis tick={axis} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Area type="monotone" dataKey="safe" stroke="oklch(0.78 0.18 200)" fill="url(#aSafe)" strokeWidth={2}/>
                <Area type="monotone" dataKey="fraud" stroke="oklch(0.66 0.24 25)" fill="url(#aFraud)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Risk distribution" sub="All transactions" className="h-80">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={riskDistribution} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={3} stroke="none">
                  {riskDistribution.map((r) => <Cell key={r.name} fill={r.color}/>)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle}/>
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {riskDistribution.map(r => (
                <div key={r.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2 w-2 rounded-full" style={{background: r.color}}/>
                  <span className="text-muted-foreground">{r.name}</span>
                  <span className="ml-auto font-medium">{r.value}%</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          <Card title="Monthly volume" sub="Transactions per month" className="lg:col-span-2 h-72">
            <ResponsiveContainer>
              <BarChart data={volumeData}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)"/>
                <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false}/>
                <YAxis tick={axis} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Bar dataKey="volume" fill="oklch(0.78 0.18 200)" radius={[6,6,0,0]}/>
                <Bar dataKey="fraud" fill="oklch(0.66 0.24 25)" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Activity by hour" sub="24h pattern" className="h-72">
            <ResponsiveContainer>
              <LineChart data={hourlyActivity}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)"/>
                <XAxis dataKey="hour" tick={{...axis, fontSize: 9}} interval={3} axisLine={false} tickLine={false}/>
                <YAxis tick={axis} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Line type="monotone" dataKey="value" stroke="oklch(0.65 0.22 285)" strokeWidth={2} dot={false}/>
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </section>

        <section className="grid lg:grid-cols-3 gap-4">
          <Card title="Recent transactions" sub="Last 10 events" className="lg:col-span-2">
            <div className="space-y-1">
              {transactions.slice(0, 8).map(t => (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/50 text-sm">
                  <div className={`h-8 w-8 rounded-lg grid place-items-center text-xs font-semibold
                    ${t.status === "fraud" ? "bg-destructive/20 text-destructive" : t.status === "review" ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>
                    {t.merchant[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.merchant} · <span className="text-muted-foreground font-normal">{t.category}</span></p>
                    <p className="text-xs text-muted-foreground">{t.id} · {t.country}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold">${t.amount}</p>
                    <p className="text-[10px] text-muted-foreground">risk {t.risk}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <AIInsights/>
        </section>
      </main>
    </>
  );
}

export function Card({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>
      <div className="mb-4">
        <p className="text-sm font-display font-semibold">{title}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function AIInsights() {
  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent pointer-events-none"/>
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center"><Brain className="h-4 w-4 text-primary-foreground"/></div>
          <div>
            <p className="text-sm font-display font-semibold">AI Insights</p>
            <p className="text-xs text-muted-foreground">Generated 2 min ago</p>
          </div>
        </div>
        <ul className="mt-4 space-y-3 text-sm">
          {[
            { t: "Fraud spike detected in Travel category at 02:00 UTC.", c: "destructive" },
            { t: "Model confidence remains above 99% across all geographies.", c: "success" },
            { t: "Velocity rules saved $12,400 in the last 24h.", c: "primary" },
            { t: "Recommend retraining NN model — drift score 0.04.", c: "warning" },
          ].map((i, idx) => (
            <li key={idx} className="flex gap-3">
              <span className={`mt-1 h-2 w-2 rounded-full bg-${i.c} shrink-0`}/>
              <span className="text-muted-foreground"><span className="text-foreground">●</span> {i.t}</span>
            </li>
          ))}
        </ul>
        <button className="mt-5 w-full glass rounded-lg py-2 text-sm hover:ring-1 hover:ring-primary/40 flex items-center justify-center gap-2">
          <Activity className="h-4 w-4 text-primary"/> Ask the AI assistant
        </button>
      </div>
    </div>
  );
}
