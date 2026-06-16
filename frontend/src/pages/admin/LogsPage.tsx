import { Topbar } from "@/components/layout/Topbar";
import { ApiError } from "@/services/api";
import { adminLogService, type SystemLog, type SystemLogFilters, type SystemLogLevel, type SystemLogSource } from "@/services/adminLogService";
import { authService } from "@/services/authService";
import { useNavigate } from "@tanstack/react-router";
import { Activity, AlertCircle, CheckCircle2, Info, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const levels: SystemLogLevel[] = ["all", "Info", "Warning", "Error", "Success"];
const sources: SystemLogSource[] = ["all", "auth", "api", "admin", "prediction", "transaction", "alert", "profile", "settings"];
const defaultFilters: SystemLogFilters = { level: "all", source: "all", page: 1, pageSize: 50 };

const levelStyles = {
  Info: "text-primary bg-primary/10",
  Warning: "text-warning bg-warning/10",
  Error: "text-destructive bg-destructive/10",
  Success: "text-success bg-success/10",
};

const levelIcons = {
  Info,
  Warning: AlertCircle,
  Error: AlertCircle,
  Success: CheckCircle2,
};

export default function LogsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<SystemLogFilters>(defaultFilters);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / (filters.pageSize ?? 50))), [filters.pageSize, totalCount]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadLogs(false), 250);
    return () => window.clearTimeout(timeout);
  }, [filters.search, filters.level, filters.source, filters.fromDate, filters.toDate, filters.page, filters.pageSize]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = window.setInterval(() => void loadLogs(true), 10_000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, filters]);

  async function loadLogs(isRefresh: boolean) {
    const token = authService.getToken();
    const role = authService.getCurrentRole();

    if (!token) {
      authService.signOut();
      void navigate({ to: "/login", replace: true });
      return;
    }

    if (role !== "admin") {
      void navigate({ to: role === "user" ? "/app" : "/login", replace: true });
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await adminLogService.getLogs(filters);
      setLogs(response.items);
      setTotalCount(response.totalCount);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        authService.signOut();
        void navigate({ to: "/login", replace: true });
        return;
      }

      if (err instanceof ApiError && err.status === 403) {
        void navigate({ to: "/app", replace: true });
        return;
      }

      setError(err instanceof Error ? err.message : "Unable to load system logs.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function clearLogs() {
    if (!window.confirm("Clear all system logs? This cannot be undone.")) return;

    try {
      const response = await adminLogService.clearLogs();
      toast.success(response.message);
      setFilters((current) => ({ ...current, page: 1 }));
      await loadLogs(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to clear logs.");
    }
  }

  function updateFilters(next: SystemLogFilters) {
    setFilters({ ...next, page: next.page ?? 1 });
  }

  return (
    <>
      <Topbar title="System Logs" subtitle="System activity logs" />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <Toolbar
          filters={filters}
          autoRefresh={autoRefresh}
          refreshing={refreshing}
          onChange={updateFilters}
          onRefresh={() => void loadLogs(true)}
          onClear={() => void clearLogs()}
          onAutoRefreshChange={setAutoRefresh}
        />

        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-display font-semibold">System activity logs</span>
            <span className="ml-auto text-xs text-muted-foreground">{totalCount.toLocaleString()} entries</span>
          </div>

          {loading && <StatePanel title="Loading logs" message="Fetching system activity from FraudGuard API." />}
          {!loading && error && <StatePanel title="Logs unavailable" message={error} destructive />}
          {!loading && !error && logs.length === 0 && <StatePanel title="No system logs found." message="Try adjusting filters or generate activity in the app." />}
          {!loading && !error && logs.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[1100px]">
                  <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <Th>Time</Th>
                      <Th>Level</Th>
                      <Th>Source</Th>
                      <Th>Message</Th>
                      <Th>User</Th>
                      <Th>Method</Th>
                      <Th>Path</Th>
                      <Th>IP address</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-t border-border hover:bg-secondary/40">
                        <Td className="text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</Td>
                        <Td><LevelBadge level={log.level} /></Td>
                        <Td><span className="rounded bg-secondary/70 px-2 py-1 text-xs uppercase">{log.source}</span></Td>
                        <Td className="max-w-md">{log.message}</Td>
                        <Td>{log.userName ?? (log.userId ? `User ${log.userId}` : "-")}</Td>
                        <Td><span className="font-mono text-xs">{log.method ?? "-"}</span></Td>
                        <Td><span className="font-mono text-xs">{log.path ?? "-"}</span></Td>
                        <Td><span className="font-mono text-xs">{log.ipAddress ?? "-"}</span></Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3 text-xs text-muted-foreground">
                <span>Page {filters.page ?? 1} of {totalPages}</span>
                <div className="flex gap-2">
                  <button disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, (current.page ?? 1) - 1) }))} className="glass rounded-lg px-3 py-1.5 disabled:opacity-40">Previous</button>
                  <button disabled={(filters.page ?? 1) >= totalPages} onClick={() => setFilters((current) => ({ ...current, page: Math.min(totalPages, (current.page ?? 1) + 1) }))} className="glass rounded-lg px-3 py-1.5 disabled:opacity-40">Next</button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

function Toolbar({
  filters,
  autoRefresh,
  refreshing,
  onChange,
  onRefresh,
  onClear,
  onAutoRefreshChange,
}: {
  filters: SystemLogFilters;
  autoRefresh: boolean;
  refreshing: boolean;
  onChange: (filters: SystemLogFilters) => void;
  onRefresh: () => void;
  onClear: () => void;
  onAutoRefreshChange: (value: boolean) => void;
}) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 glass rounded-lg px-3 py-2 flex-1 min-w-[260px]">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={filters.search ?? ""} onChange={(event) => onChange({ ...filters, search: event.target.value, page: 1 })} placeholder="Search message, user, path, IP..." className="flex-1 bg-transparent text-sm outline-none" />
      </div>
      <select value={filters.level ?? "all"} onChange={(event) => onChange({ ...filters, level: event.target.value as SystemLogLevel, page: 1 })} className="glass rounded-lg px-3 py-2 text-xs bg-background outline-none">
        {levels.map((level) => <option key={level} value={level}>{level === "all" ? "All levels" : level}</option>)}
      </select>
      <select value={filters.source ?? "all"} onChange={(event) => onChange({ ...filters, source: event.target.value as SystemLogSource, page: 1 })} className="glass rounded-lg px-3 py-2 text-xs bg-background outline-none">
        {sources.map((source) => <option key={source} value={source}>{source === "all" ? "All sources" : sourceLabel(source)}</option>)}
      </select>
      <input type="date" value={filters.fromDate ?? ""} onChange={(event) => onChange({ ...filters, fromDate: event.target.value || undefined, page: 1 })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <input type="date" value={filters.toDate ?? ""} onChange={(event) => onChange({ ...filters, toDate: event.target.value || undefined, page: 1 })} className="glass rounded-lg px-3 py-2 text-xs bg-transparent outline-none" />
      <button onClick={onRefresh} disabled={refreshing} className="inline-flex items-center gap-2 glass rounded-lg px-3 py-2 text-xs hover:ring-1 hover:ring-primary/40 disabled:opacity-60">
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
      </button>
      <label className="inline-flex items-center gap-2 glass rounded-lg px-3 py-2 text-xs">
        <input type="checkbox" checked={autoRefresh} onChange={(event) => onAutoRefreshChange(event.target.checked)} className="accent-primary" />
        Auto-refresh
      </label>
      <button onClick={onClear} className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10">
        <Trash2 className="h-3.5 w-3.5" /> Clear logs
      </button>
    </div>
  );
}

function LevelBadge({ level }: { level: SystemLog["level"] }) {
  const Icon = levelIcons[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] uppercase ${levelStyles[level]}`}>
      <Icon className="h-3 w-3" /> {level}
    </span>
  );
}

function StatePanel({ title, message, destructive }: { title: string; message: string; destructive?: boolean }) {
  return (
    <div className={`p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      {!destructive && title !== "No system logs found." && <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />}
      <h2 className="mt-4 text-xl font-display font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function sourceLabel(source: SystemLogSource) {
  return source === "api" ? "API" : source.charAt(0).toUpperCase() + source.slice(1);
}

function formatDateTime(value: string) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "";
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left font-medium px-4 py-3">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}
