import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/topbar";
import { models } from "@/lib/mock-data";
import { Brain, Play, RefreshCw, Power } from "lucide-react";

export const Route = createFileRoute("/_admin/admin/models")({
  component: AdminModels,
});

function AdminModels() {
  return (
    <>
      <Topbar title="AI Models" subtitle="Deploy, retrain and monitor models in production"/>
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <div className="grid lg:grid-cols-2 gap-4">
          {models.map(m => (
            <div key={m.name} className={`glass rounded-2xl p-6 ${m.best ? "ring-1 ring-primary/40" : ""}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-primary grid place-items-center"><Brain className="h-5 w-5 text-primary-foreground"/></div>
                  <div>
                    <p className="font-display font-semibold">{m.name}</p>
                    <p className="text-xs text-muted-foreground">v4.{Math.floor(Math.random()*9)} · {m.best ? "Active in production" : "Stand-by"}</p>
                  </div>
                </div>
                <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded ${m.best ? "bg-success/20 text-success" : "bg-secondary text-muted-foreground"}`}>
                  {m.best ? "Live" : "Idle"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                {[["Acc",`${m.acc}%`],["Prec",`${m.prec}%`],["Rec",`${m.rec}%`],["F1",`${m.f1}%`]].map(([k,v]) => (
                  <div key={k} className="glass rounded-md p-2"><p className="text-[10px] text-muted-foreground">{k}</p><p className="font-semibold">{v}</p></div>
                ))}
              </div>
              <div className="mt-4 flex gap-2 text-xs">
                <button className="glass rounded-lg px-3 py-2 flex items-center gap-1.5 hover:ring-1 hover:ring-primary/40"><Play className="h-3 w-3"/> Run benchmark</button>
                <button className="glass rounded-lg px-3 py-2 flex items-center gap-1.5 hover:ring-1 hover:ring-primary/40"><RefreshCw className="h-3 w-3"/> Retrain</button>
                <button className="ml-auto glass rounded-lg px-3 py-2 flex items-center gap-1.5 hover:ring-1 hover:ring-destructive/40 text-destructive"><Power className="h-3 w-3"/> Disable</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
