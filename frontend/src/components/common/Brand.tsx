import { CircuitBoard, ShieldCheck } from "lucide-react";

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  const i = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  return (
    <div className="flex items-center gap-2">
      <div className={`${i} relative grid place-items-center rounded-lg bg-gradient-primary ring-glow overflow-hidden`}>
        <ShieldCheck className="h-[62%] w-[62%] text-primary-foreground" strokeWidth={2.4} />
        <CircuitBoard className="absolute h-[38%] w-[38%] text-primary-foreground/45" strokeWidth={2} />
        <span className="absolute inset-0 rounded-lg ring-1 ring-white/25" />
      </div>
      <span className={`${s} font-display font-semibold tracking-tight`}>
        Fraud<span className="text-gradient">Guard</span>
      </span>
    </div>
  );
}
