import { Topbar } from "@/components/layout/Topbar";
import { adminModelsApi } from "@/services/adminModelsApi";
import type { AdminModel, AdminModelStatus } from "@/types/adminModel";
import { AlertTriangle, Brain, CheckCircle2, Loader2, Play, Power, RefreshCw, Rocket, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ModelAction = "benchmark" | "retrain" | "enable" | "disable" | "activate";

const statusTone: Record<string, string> = {
  live: "bg-success/20 text-success",
  idle: "bg-secondary text-muted-foreground",
  disabled: "bg-destructive/15 text-destructive",
  training: "bg-warning/20 text-warning",
  benchmarking: "bg-primary/20 text-primary",
  error: "bg-destructive/20 text-destructive",
};

export default function AdminModels() {
  const [models, setModels] = useState<AdminModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<Record<string, ModelAction | null>>({});

  useEffect(() => {
    void loadModels();
  }, []);

  async function loadModels() {
    setLoading(true);
    setError(null);
    try {
      setModels(await adminModelsApi.getModels());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load AI models.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function runAction(model: AdminModel, action: ModelAction) {
    if (action === "disable" && model.isActive) {
      const confirmed = window.confirm("This is the live model. Disable it and automatically switch to the best available enabled model?");
      if (!confirmed) {
        return;
      }
    }

    setRunning((current) => ({ ...current, [model.id]: action }));
    setModels((current) =>
      current.map((item) =>
        item.id === model.id
          ? { ...item, status: action === "benchmark" ? "benchmarking" : action === "retrain" ? "training" : item.status }
          : item,
      ),
    );

    try {
      const updated = await actionCall(model.id, action);
      const fresh = await adminModelsApi.getModels();
      setModels(fresh.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(successMessage(action, updated.displayName));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Model action failed.";
      try {
        setModels(await adminModelsApi.getModels());
      } catch {
        setModels((current) => current.map((item) => (item.id === model.id ? { ...item, status: "error" } : item)));
      }
      toast.error(message.includes("ML service") ? message : `${model.displayName}: ${message}`);
    } finally {
      setRunning((current) => ({ ...current, [model.id]: null }));
    }
  }

  const best = useMemo(
    () => models.find((model) => model.isActive) ?? models.slice().sort((a, b) => (b.f1Score ?? 0) - (a.f1Score ?? 0))[0],
    [models],
  );

  return (
    <>
      <Topbar title="AI Models" subtitle="Deploy, retrain and monitor models in production" />
      <main className="scrollbar-thin flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-4 md:p-8 space-y-4 pb-10">
        {loading && <StatePanel title="Loading AI models" message="Fetching model registry from FraudGuard ML service." spin />}
        {!loading && error && <StatePanel title="AI model service unavailable" message={error} destructive />}
        {!loading && !error && models.length === 0 && <StatePanel title="No models registered" message="Run the ML service to initialize the model registry." />}

        {!loading && !error && best && (
          <div className="glass rounded-2xl p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Active production model</p>
              <h2 className="mt-1 font-display text-2xl font-semibold">{best.displayName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{best.notes ?? "Model registry entry"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Mini label="Accuracy" value={formatMetric(best.accuracy)} />
              <Mini label="Precision" value={formatMetric(best.precision)} />
              <Mini label="Recall" value={formatMetric(best.recall)} />
              <Mini label="F1" value={formatMetric(best.f1Score)} />
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="grid gap-4 lg:grid-cols-2">
            {models.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                running={running[model.id] ?? null}
                onAction={(action) => void runAction(model, action)}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function ModelCard({
  model,
  running,
  onAction,
}: {
  model: AdminModel;
  running: ModelAction | null;
  onAction: (action: ModelAction) => void;
}) {
  const busy = running !== null;
  const status = normalizeStatus(model.status, running);
  const disabled = busy || status === "training" || status === "benchmarking";

  return (
    <div className={`glass rounded-2xl p-6 relative ${model.isActive ? "ring-1 ring-primary/40" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display font-semibold">{model.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {model.version || "v1.0.0"} - {model.isActive ? "Active in production" : model.isEnabled ? "Stand-by" : "Disabled"}
            </p>
            {model.isEnabled && !model.artifactExists && (
              <p className="mt-1 text-[10px] uppercase tracking-wider text-warning">Retrain required</p>
            )}
          </div>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-[10px] uppercase tracking-wider ${statusTone[status] ?? statusTone.idle}`}>
          {status}
        </span>
      </div>

      <p className="mt-4 min-h-10 text-sm leading-5 text-muted-foreground">{model.notes ?? "No model notes available."}</p>

      <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
        <Mini label="Acc" value={formatMetric(model.accuracy)} />
        <Mini label="Prec" value={formatMetric(model.precision)} />
        <Mini label="Rec" value={formatMetric(model.recall)} />
        <Mini label="F1" value={formatMetric(model.f1Score)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
        <span>Trained: {formatDate(model.lastTrainedAt)}</span>
        <span className="text-right">Benchmarked: {formatDate(model.lastBenchmarkedAt)}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <ActionButton disabled={disabled || !model.isEnabled || !model.artifactExists} icon={Play} onClick={() => onAction("benchmark")}>
          Run benchmark
        </ActionButton>
        <ActionButton disabled={disabled || !model.isEnabled} icon={RefreshCw} onClick={() => onAction("retrain")}>
          Retrain
        </ActionButton>
        {!model.isActive && model.isEnabled && (
          <ActionButton disabled={disabled || !model.artifactExists} icon={Rocket} onClick={() => onAction("activate")}>
            Activate
          </ActionButton>
        )}
        <button
          disabled={disabled}
          onClick={() => onAction(model.isEnabled ? "disable" : "enable")}
          className={`ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 glass hover:ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${
            model.isEnabled ? "text-destructive hover:ring-destructive/40" : "text-success hover:ring-success/40"
          }`}
        >
          {busy && running === (model.isEnabled ? "disable" : "enable") ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
          {model.isEnabled ? "Disable" : "Enable"}
        </button>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-md p-2">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  disabled,
  icon: Icon,
  onClick,
}: {
  children: ReactNode;
  disabled: boolean;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={disabled ? "Retrain required before this action is available." : undefined}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 glass hover:ring-1 hover:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className="h-3 w-3" />
      {children}
    </button>
  );
}

function StatePanel({ title, message, spin, destructive }: { title: string; message: string; spin?: boolean; destructive?: boolean }) {
  const Icon = destructive ? AlertTriangle : spin ? Loader2 : CheckCircle2;
  return (
    <div className={`glass rounded-2xl p-10 text-center ${destructive ? "ring-1 ring-destructive/40" : ""}`}>
      <Icon className={`mx-auto h-10 w-10 ${spin ? "animate-spin" : ""} ${destructive ? "text-destructive" : "text-primary"}`} />
      <h2 className="mt-4 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function actionCall(id: string, action: ModelAction) {
  if (action === "benchmark") return adminModelsApi.runBenchmark(id);
  if (action === "retrain") return adminModelsApi.retrainModel(id);
  if (action === "enable") return adminModelsApi.enableModel(id);
  if (action === "disable") return adminModelsApi.disableModel(id);
  return adminModelsApi.activateModel(id);
}

function successMessage(action: ModelAction, name: string) {
  if (action === "benchmark") return `Benchmark completed for ${name}`;
  if (action === "retrain") return `Retraining completed for ${name}`;
  if (action === "enable") return `${name} enabled`;
  if (action === "disable") return `${name} disabled`;
  return `${name} is now live`;
}

function normalizeStatus(status: string, running: ModelAction | null): AdminModelStatus {
  if (running === "benchmark") return "benchmarking";
  if (running === "retrain") return "training";
  const normalized = status.toLowerCase();
  if (["live", "idle", "disabled", "training", "benchmarking", "error"].includes(normalized)) {
    return normalized as AdminModelStatus;
  }
  return "idle";
}

function formatMetric(value: number | null | undefined) {
  return value === null || value === undefined ? "N/A" : `${value.toFixed(value >= 99 ? 2 : 1)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}
