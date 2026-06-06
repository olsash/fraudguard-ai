import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/common/StatCard";
import { dashboardService } from "@/services/dashboardService";
import type { DashboardSummary, PredictionChartPoint, RecentPrediction, RiskDistributionPoint } from "@/types/dashboard";
import {
  Activity,
  AlertTriangle,
  Brain,
  Gauge,
  History,
  Loader2,
  Receipt,
  ShieldCheck,
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

export default function Dashboard() {
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
          setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
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
      <Topbar title="Dashboard" subtitle="Live overview of your fraud detection workspace" />
      <main className="flex-1 p-4 md:p-8 space-y-6">
        {loading && <StatePanel icon={Loader2} title="Loading dashboard" message="Fetching your prediction statistics from FraudGuard API." spin />}
        {!loading && error && <StatePanel icon={AlertTriangle} title="Dashboard unavailable" message={error} tone="destructive" />}
        {!loading && !error && summary && <DashboardContent summary={summary} />}
      </main>
    </>
  );
}

function DashboardContent({ summary }: { summary: DashboardSummary }) {
  const latest = summary.latestPrediction;

  return (
    <>
      {summary.totalPredictions === 0 && (
        <div className="glass rounded-2xl p-5 text-sm text-muted-foreground">
          No predictions available yet. Run your first fraud analysis to generate insights.
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard label="Total transactions" value={summary.totalTransactions.toLocaleString()} icon={Receipt} />
        <StatCard label="Pending analysis" value={summary.pendingTransactions.toLocaleString()} icon={History} tone="primary" />
        <StatCard label="Safe transactions" value={summary.safeTransactions.toLocaleString()} icon={ShieldCheck} tone="success" />
        <StatCard label="Review" value={summary.reviewTransactions.toLocaleString()} icon={Gauge} tone="warning" />
        <StatCard label="Fraud detected" value={summary.fraudTransactions.toLocaleString()} icon={AlertTriangle} tone="destructive" />
        <StatCard label="Average risk" value={`${summary.averageRiskScore}/100`} icon={Gauge} tone="warning" />
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <Card title="Predictions per day" sub="Last 7 days" className="lg:col-span-2 h-80">
          <DailyAreaChart data={summary.predictionsPerDay} />
        </Card>

        <Card title="Risk distribution" sub="Your prediction history" className="h-80">
          <RiskDistributionChart data={summary.riskDistribution} total={summary.totalTransactions} />
        </Card>
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <LatestPrediction prediction={latest} />

        <Card title="Prediction volume" sub="Safe vs fraud, last 7 days" className="lg:col-span-2 h-72">
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
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        <Card title="Recent predictions" sub="Latest saved model decisions" className="lg:col-span-2">
          <RecentPredictions predictions={summary.recentPredictions} />
        </Card>
        <LiveInsights summary={summary} />
      </section>
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

function DailyAreaChart({ data }: { data: PredictionChartPoint[] }) {
  return (
    <ResponsiveContainer>
      <AreaChart data={toChartData(data)}>
        <defs>
          <linearGradient id="dailyTotal" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0.5} />
            <stop offset="100%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="dailyFraud" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.66 0.24 25)" stopOpacity={0.55} />
            <stop offset="100%" stopColor="oklch(0.66 0.24 25)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="oklch(1 0 0 / 0.05)" />
        <XAxis dataKey="day" tick={axis} axisLine={false} tickLine={false} />
        <YAxis tick={axis} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area type="monotone" dataKey="total" stroke="oklch(0.78 0.18 200)" fill="url(#dailyTotal)" strokeWidth={2} />
        <Area type="monotone" dataKey="fraud" stroke="oklch(0.66 0.24 25)" fill="url(#dailyFraud)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function RiskDistributionChart({ data, total }: { data: RiskDistributionPoint[]; total: number }) {
  const chartData = data.map((item) => ({
    name: item.riskLevel,
    value: item.count,
    percent: total === 0 ? 0 : Math.round((item.count / total) * 100),
    color: riskColors[item.riskLevel],
  }));

  return (
    <>
      <ResponsiveContainer height="70%">
        <PieChart>
          <Pie data={chartData} dataKey="value" innerRadius={58} outerRadius={88} paddingAngle={3} stroke="none">
            {chartData.map((item) => <Cell key={item.name} fill={item.color} />)}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            <span className="text-muted-foreground">{item.name}</span>
            <span className="ml-auto font-medium">{item.count} ({item.percent}%)</span>
          </div>
        ))}
      </div>
    </>
  );
}

function LatestPrediction({ prediction }: { prediction: RecentPrediction | null }) {
  return (
    <Card title="Latest prediction" sub="Most recent saved decision" className="h-72">
      {prediction ? (
        <div className="h-full flex flex-col justify-between">
          <div>
            <div className={`inline-flex rounded-lg px-3 py-1 text-xs font-semibold ${prediction.isFraud ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"}`}>
              {prediction.isFraud ? "Fraud detected" : "Transaction safe"}
            </div>
            <p className="mt-4 text-3xl font-display font-semibold">{prediction.riskScore}/100</p>
            <p className="text-sm text-muted-foreground">{prediction.riskLevel} risk - {prediction.transactionType}</p>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount</span>
              <span className="font-mono">{formatCurrency(prediction.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Scored</span>
              <span>{formatDateTime(prediction.createdAt)}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Run a prediction to populate this card.</p>
      )}
    </Card>
  );
}

function RecentPredictions({ predictions }: { predictions: RecentPrediction[] }) {
  if (predictions.length === 0) {
    return <p className="text-sm text-muted-foreground">No predictions available yet.</p>;
  }

  return (
    <div className="space-y-1">
      {predictions.map((prediction) => (
        <div key={prediction.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/50 text-sm">
          <div className={`h-8 w-8 rounded-lg grid place-items-center text-xs font-semibold
            ${prediction.isFraud ? "bg-destructive/20 text-destructive" : "bg-success/20 text-success"}`}>
            {prediction.transactionType[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{prediction.transactionType} - <span className="text-muted-foreground font-normal">{formatCurrency(prediction.amount)}</span></p>
            <p className="text-xs text-muted-foreground">{formatDateTime(prediction.createdAt)}</p>
          </div>
          <div className="text-right">
            <p className={prediction.isFraud ? "font-semibold text-destructive" : "font-semibold text-success"}>{prediction.riskScore}/100</p>
            <p className="text-[10px] text-muted-foreground">{prediction.riskLevel}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LiveInsights({ summary }: { summary: DashboardSummary }) {
  const fraudRate = summary.totalTransactions === 0
    ? 0
    : Math.round((summary.fraudTransactions / summary.totalTransactions) * 100);

  return (
    <div className="glass rounded-2xl p-5 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/20 to-transparent pointer-events-none" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center"><Brain className="h-4 w-4 text-primary-foreground" /></div>
          <div>
            <p className="text-sm font-display font-semibold">AI Insights</p>
            <p className="text-xs text-muted-foreground">Generated from your saved predictions</p>
          </div>
        </div>
        <ul className="mt-4 space-y-3 text-sm">
          <Insight text={`${fraudRate}% of your transactions are currently flagged as fraud.`} tone="destructive" />
          <Insight text={`Average risk score is ${summary.averageRiskScore}/100 across ${summary.totalTransactions.toLocaleString()} transactions.`} tone="warning" />
          <Insight text={`Highest risk case reached ${summary.highestRiskScore}/100.`} tone="primary" />
          <Insight text={`${summary.safeTransactions.toLocaleString()} transactions were classified as safe.`} tone="success" />
        </ul>
        <div className="mt-5 w-full glass rounded-lg py-2 text-sm flex items-center justify-center gap-2 text-muted-foreground">
          <Activity className="h-4 w-4 text-primary" /> Dashboard updates after each new prediction
        </div>
      </div>
    </div>
  );
}

function Insight({ text, tone }: { text: string; tone: "destructive" | "success" | "primary" | "warning" }) {
  const color = {
    destructive: "bg-destructive",
    success: "bg-success",
    primary: "bg-primary",
    warning: "bg-warning",
  }[tone];

  return (
    <li className="flex gap-3">
      <span className={`mt-1 h-2 w-2 rounded-full ${color} shrink-0`} />
      <span className="text-muted-foreground">{text}</span>
    </li>
  );
}

function StatePanel({
  icon: Icon,
  title,
  message,
  spin,
  tone = "primary",
}: {
  icon: typeof Loader2;
  title: string;
  message: string;
  spin?: boolean;
  tone?: "primary" | "destructive";
}) {
  return (
    <div className={`glass rounded-2xl p-10 text-center ${tone === "destructive" ? "ring-1 ring-destructive/40" : ""}`}>
      <Icon className={`h-10 w-10 mx-auto ${spin ? "animate-spin" : ""} ${tone === "destructive" ? "text-destructive" : "text-primary"}`} />
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
