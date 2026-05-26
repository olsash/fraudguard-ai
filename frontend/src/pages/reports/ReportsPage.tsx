import { Topbar } from "@/components/layout/Topbar";
import { fraudTrend, volumeData, geoFraud } from "@/data/mockData";
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Download, FileText, Sheet } from "lucide-react";

const axis = { fontSize: 11, fill: "oklch(0.68 0.03 250)" };
const tooltipStyle = { background: "oklch(0.21 0.03 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8, fontSize: 12 };

export default function Reports() {
  return (
    <>
      <Topbar title="Reports & Analytics" subtitle="Deep insights - exportable in multiple formats"/>
      <main className="flex-1 p-4 md:p-8 space-y-6">
        <div className="glass rounded-2xl p-5 flex flex-wrap items-center gap-3">
          <p className="font-display font-semibold">Monthly fraud report</p>
          <span className="text-xs text-muted-foreground">Generated for September 2026</span>
          <div className="ml-auto flex gap-2">
            <button className="glass rounded-lg px-3 py-2 text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-destructive"/> PDF</button>
            <button className="glass rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Sheet className="h-4 w-4 text-success"/> Excel</button>
            <button className="bg-gradient-primary text-primary-foreground rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Download className="h-4 w-4"/> CSV</button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="glass rounded-2xl p-5 h-72">
            <p className="font-display font-semibold">Fraud trend</p>
            <ResponsiveContainer>
              <AreaChart data={fraudTrend}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)"/>
                <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false}/>
                <YAxis tick={axis} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Area type="monotone" dataKey="fraud" stroke="oklch(0.66 0.24 25)" fill="oklch(0.66 0.24 25 / 0.3)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="glass rounded-2xl p-5 h-72">
            <p className="font-display font-semibold">Risky categories</p>
            <ResponsiveContainer>
              <BarChart data={[
                { c: "Travel", v: 312 }, { c: "Tech", v: 248 }, { c: "Fashion", v: 187 },
                { c: "Fuel", v: 154 }, { c: "Food", v: 88 }, { c: "Retail", v: 61 },
              ]}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.05)"/>
                <XAxis dataKey="c" tick={axis} axisLine={false} tickLine={false}/>
                <YAxis tick={axis} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={tooltipStyle}/>
                <Bar dataKey="v" fill="oklch(0.65 0.22 285)" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="font-display font-semibold">Geographic fraud analysis</p>
          <p className="text-xs text-muted-foreground mb-4">Fraud cases by country</p>
          <div className="space-y-2">
            {geoFraud.sort((a,b)=>b.value-a.value).map(g => (
              <div key={g.country} className="flex items-center gap-3">
                <span className="w-40 text-sm">{g.country}</span>
                <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full bg-gradient-primary" style={{ width: `${(g.value/412)*100}%` }}/>
                </div>
                <span className="w-12 text-right font-mono text-sm">{g.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <p className="font-display font-semibold">Peak fraud hours</p>
          <ResponsiveContainer height={240}>
            <BarChart data={volumeData}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)"/>
              <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false}/>
              <YAxis tick={axis} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={tooltipStyle}/>
              <Bar dataKey="fraud" fill="oklch(0.66 0.24 25)" radius={[6,6,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </main>
    </>
  );
}
