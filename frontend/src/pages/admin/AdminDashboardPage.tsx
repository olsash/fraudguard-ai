import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/common/StatCard";
import { Card } from "@/pages/dashboard/DashboardPage";
import { dashboardService } from "@/services/dashboardService";
import type { DashboardSummary, PredictionChartPoint, RecentPrediction, RiskDistributionPoint } from "@/types/dashboard";
import {
  AlertTriangle,
  Brain,
  Gauge,
  Loader2,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const axis = { fontSize: 11, fill: "oklch(0.68 0.03 250)" };
const tooltipStyle = { background: "oklch(0.21 0.03 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 8, fontSize: 12 };
const riskColors: Record<string, string> = {
  Low: "oklch(0.72 0.18 155)",
  Medium: "oklch(0.8 0.17 75)",
  High: "oklch(0.7 0.2 30)",
  Critical: "oklch(0.66 0.24 25)",
};

export default function AdminDash() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError(null);

      try {
        const data = await dashboardService.getDashboardSummary();
        if (active) {
          setSummary(data);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unable to load admin dashboard data.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Topbar title="Admin Overview" subtitle="Enterprise control plane - global fraud detection metrics" />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        {loading && <StatePanel title="Loading admin dashboard" message="Fetching global prediction statistics from FraudGuard API." />}
        {!loading && error && <StatePanel title="Admin dashboard unavailable" message={error} destructive />}
        {!loading && !error && summary && <AdminDashboardContent summary={summary} />}
      </main>
    </>
  );
}

function AdminDashboardContent({ summary }: { summary: DashboardSummary }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total users" value={(summary.totalUsers ?? 0).toLocaleString()} icon={Users} />
        <StatCard label="Total predictions" value={summary.totalPredictions.toLocaleString()} icon={Receipt} tone="violet" />
        <StatCard label="Fraud transactions" value={summary.fraudTransactions.toLocaleString()} icon={AlertTriangle} tone="destructive" />
        <StatCard label="High risk cases" value={(summary.highRiskCases ?? 0).toLocaleString()} icon={ShieldAlert} tone="warning" />
        <StatCard label="Critical cases" value={(summary.criticalRiskCases ?? 0).toLocaleString()} icon={ShieldAlert} tone="destructive" />
        <StatCard label="Average risk" value={`${summary.averageRiskScore}/100`} icon={Gauge} tone="warning" />
        <StatCard label="Highest risk" value={`${summary.highestRiskScore}/100`} icon={Brain} tone="primary" />
        <StatCard label="Safe transactions" value={summary.safeTransactions.toLocaleString()} icon={ShieldCheck} tone="success" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Recent predictions" sub="Global live decision feed" className="h-80">
          <RecentFeed predictions={summary.recentPredictions} />
        </Card>

        <Card title="Detection trend" sub="Last 7 days" className="lg:col-span-2 h-80">
          <ResponsiveContainer>
            <AreaChart data={toChartData(summary.predictionsPerDay)}>
              <defs>
                <linearGradient id="adminFraud" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.66 0.24 25)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="oklch(0.66 0.24 25)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="adminTotal" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.65 0.22 285)" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="oklch(0.65 0.22 285)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
              <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} />
              <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="total" stroke="oklch(0.65 0.22 285)" fill="url(#adminTotal)" strokeWidth={2} />
              <Area type="monotone" dataKey="fraud" stroke="oklch(0.66 0.24 25)" fill="url(#adminFraud)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title="Risk distribution" sub="All stored predictions" className="h-80">
          <RiskDistribution data={summary.riskDistribution} total={summary.totalPredictions} />
        </Card>

        <Card title="Safe vs fraud" sub="Last 7 days" className="h-80">
          <ResponsiveContainer>
            <BarChart data={toChartData(summary.predictionsPerDay)}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
              <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} />
              <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="safe" fill="oklch(0.72 0.18 155)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="fraud" fill="oklch(0.66 0.24 25)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </>
  );
}

function RecentFeed({ predictions }: { predictions: RecentPrediction[] }) {
  if (predictions.length === 0) {
    return (
      <div className="h-64 grid place-items-center text-sm text-muted-foreground">
        No predictions available yet.
      </div>
    );
  }

  return (
    <div className="space-y-2 overflow-y-auto h-64 scrollbar-thin pr-2">
      {predictions.map((prediction) => (
        <div
          key={prediction.id}
          className="flex items-center gap-2 text-xs border-l-2 pl-2 py-1.5"
          style={{ borderColor: prediction.isFraud ? "oklch(0.66 0.24 25)" : "oklch(0.72 0.18 155)" }}
        >
          <span className="font-mono text-muted-foreground">#{prediction.id}</span>
          <span className="flex-1 truncate">{prediction.userEmail ?? `User ${prediction.userId}`} - {prediction.transactionType}</span>
          <span className="font-mono">{formatCurrency(prediction.amount)}</span>
          <span className={prediction.isFraud ? "font-semibold text-destructive" : "font-semibold text-success"}>{prediction.riskScore}</span>
        </div>
      ))}
    </div>
  );
}

function RiskDistribution({ data, total }: { data: RiskDistributionPoint[]; total: number }) {
  const chartData = data.map((item) => ({
    name: item.riskLevel,
    value: item.count,
    percent: total === 0 ? 0 : Math.round((item.count / total) * 100),
    color: riskColors[item.riskLevel],
  }));

  return (
    <div className="grid md:grid-cols-2 gap-4 h-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={chartData} dataKey="value" innerRadius={55} outerRadius={88} paddingAngle={3} stroke="none">
            {chartData.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-3 self-center">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-3 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-mono">{item.value}</span>
            <span className="w-10 text-right text-xs text-muted-foreground">{item.percent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatePanel({ title, message, destructive }: { title: string; message: string; destructive?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      {destructive ? (
        <AlertTriangle className="h-10 w-10 mx-auto text-destructive" />
      ) : (
        <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
      )}
      <h2 className="mt-4 text-xl font-display font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function toChartData(points: PredictionChartPoint[]) {
  return points.map((point) => ({
    ...point,
    day: new Date(`${point.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
