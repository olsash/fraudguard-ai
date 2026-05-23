import { ShieldCheck } from "lucide-react";

export function Brand({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
  const i = size === "sm" ? "h-6 w-6" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  return (
    <div className="flex items-center gap-2">
      <div className={`${i} relative grid place-items-center rounded-lg bg-gradient-primary ring-glow`}>
        <ShieldCheck className="h-1/2 w-1/2 text-primary-foreground" strokeWidth={2.5} />
        <span className="absolute inset-0 rounded-lg ring-1 ring-white/20" />
      </div>
      <span className={`${s} font-display font-semibold tracking-tight`}>
        Sentinel<span className="text-gradient">AI</span>
      </span>
    </div>
  );
}
