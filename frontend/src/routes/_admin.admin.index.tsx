import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/topbar";
import { StatCard } from "@/components/stat-card";
import { Users, Receipt, AlertTriangle, ShieldCheck, Brain, Activity, Server, ShieldAlert } from "lucide-react";
import { KPI, fraudTrend, geoFraud, volumeData, transactions } from "@/lib/mock-data";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Card } from "./_app.app.index";

export const Route = createFileRoute("/_admin/admin/")({
  component: AdminDash,
});

const axis = { fontSize: 11, fill: "oklch(0.68 0.03 250)" };
const tooltipStyle = { background: "oklch(0.21 0.03 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8, fontSize: 12 };

function AdminDash() {
  return (
    <>
      <Topbar title="Admin Overview" subtitle="Enterprise control plane · live system health"/>
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total users" value={KPI.activeUsers.toLocaleString()} delta={4.2} icon={Users}/>
          <StatCard label="Transactions" value={KPI.totalTx.toLocaleString()} delta={12.4} icon={Receipt} tone="violet"/>
          <StatCard label="Fraud cases" value={KPI.fraudDetected.toLocaleString()} delta={-8.1} icon={AlertTriangle} tone="destructive"/>
          <StatCard label="High-risk alerts" value={KPI.alertsToday} delta={6.1} icon={ShieldAlert} tone="warning"/>
          <StatCard label="AI accuracy" value={`${KPI.accuracy}%`} delta={0.3} icon={Brain} tone="primary"/>
          <StatCard label="System health" value={`${KPI.systemHealth}%`} delta={0.1} icon={Server} tone="success"/>
          <StatCard label="Active sessions" value={"1,284"} delta={2.4} icon={Activity}/>
          <StatCard label="Today's detections" value={"312"} delta={11.4} icon={ShieldCheck} tone="success"/>
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card title="Live fraud feed" sub="Real-time stream" className="h-80">
            <div className="space-y-2 overflow-y-auto h-64 scrollbar-thin pr-2">
              {transactions.slice(0, 12).map(t => (
                <div key={t.id} className="flex items-center gap-2 text-xs border-l-2 pl-2 py-1.5"
                  style={{ borderColor: t.status === "fraud" ? "oklch(0.66 0.24 25)" : t.status === "review" ? "oklch(0.8 0.17 75)" : "oklch(0.72 0.18 155)" }}>
                  <span className="font-mono text-muted-foreground">{t.id}</span>
                  <span className="flex-1 truncate">{t.merchant} · {t.country}</span>
                  <span className="font-mono">${t.amount}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Detection trend" sub="14 days" className="lg:col-span-2 h-80">
            <ResponsiveContainer>
              <AreaChart data={fraudTrend}>
                <defs>
                  <linearGradient id="adFraud" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.66 0.24 25)" stopOpacity={0.6}/>
                    <stop offset="100%" stopColor="oklch(0.66 0.24 25)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)"/>
                <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false}/>
                <YAxis tick={axis} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Area type="monotone" dataKey="fraud" stroke="oklch(0.66 0.24 25)" fill="url(#adFraud)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card title="Geographic fraud map" sub="Top regions by fraud cases">
            <div className="space-y-2">
              {geoFraud.sort((a,b)=>b.value-a.value).map(g => (
                <div key={g.country} className="flex items-center gap-3 text-sm">
                  <span className="w-44 text-muted-foreground">{g.country}</span>
                  <div className="flex-1 h-2 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-gradient-primary" style={{ width: `${(g.value/412)*100}%` }}/>
                  </div>
                  <span className="font-mono text-xs w-10 text-right">{g.value}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Volume vs fraud" sub="Monthly" className="h-80">
            <ResponsiveContainer>
              <BarChart data={volumeData}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)"/>
                <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false}/>
                <YAxis tick={axis} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Bar dataKey="volume" fill="oklch(0.65 0.22 285)" radius={[6,6,0,0]}/>
                <Bar dataKey="fraud" fill="oklch(0.66 0.24 25)" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </main>
    </>
  );
}
