import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/topbar";
import { transactions } from "@/lib/mock-data";
import { useMemo, useState } from "react";
import { Download, Filter, Search, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/app/transactions")({
  component: TxPage,
});

function TxPage() {
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState<string>("all");
  const [sel, setSel] = useState<typeof transactions[0] | null>(null);

  const rows = useMemo(() => transactions.filter(t => {
    if (statusF !== "all" && t.status !== statusF) return false;
    if (q && !(t.id + t.merchant + t.user).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [q, statusF]);

  return (
    <>
      <Topbar title="Transactions" subtitle={`${rows.length} of ${transactions.length} transactions`}/>
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 glass rounded-lg px-3 py-2 flex-1 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground"/>
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search ID, merchant, user…" className="flex-1 bg-transparent text-sm outline-none"/>
          </div>
          <div className="flex items-center gap-1">
            {["all","safe","review","fraud"].map(s => (
              <button key={s} onClick={()=>setStatusF(s)}
                className={`text-xs px-3 py-1.5 rounded-lg capitalize ${statusF===s ? "bg-primary text-primary-foreground" : "glass hover:ring-1 hover:ring-primary/40"}`}>
                {s}
              </button>
            ))}
          </div>
          <button className="glass rounded-lg px-3 py-2 text-sm flex items-center gap-2 hover:ring-1 hover:ring-primary/40"><Filter className="h-4 w-4"/> Filters</button>
          <button className="bg-gradient-primary text-primary-foreground rounded-lg px-3 py-2 text-sm flex items-center gap-2"><Download className="h-4 w-4"/> Export</button>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <Th>ID</Th><Th>Merchant</Th><Th>User</Th><Th>Country</Th><Th>Amount</Th><Th>Risk</Th><Th>Status</Th><Th>Time</Th><Th/>
              </tr>
            </thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.id} onClick={()=>setSel(t)} className="border-t border-border hover:bg-secondary/40 cursor-pointer">
                  <Td><span className="font-mono text-xs">{t.id}</span></Td>
                  <Td><div className="flex items-center gap-2"><div className="h-7 w-7 rounded-md bg-gradient-primary grid place-items-center text-[10px] font-semibold text-primary-foreground">{t.merchant[0]}</div>{t.merchant}</div></Td>
                  <Td>{t.user}</Td>
                  <Td>{t.country}</Td>
                  <Td className="font-mono font-semibold">${t.amount}</Td>
                  <Td><RiskBar value={t.risk}/></Td>
                  <Td><StatusBadge s={t.status}/></Td>
                  <Td className="text-xs text-muted-foreground">{new Date(t.time).toLocaleString()}</Td>
                  <Td><ChevronRight className="h-4 w-4 text-muted-foreground"/></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      {sel && <TxModal tx={sel} onClose={()=>setSel(null)}/>}
    </>
  );
}

export function Th({ children }: { children?: React.ReactNode }) { return <th className="text-left font-medium px-4 py-3">{children}</th>; }
export function Td({ children, className = "" }: any) { return <td className={`px-4 py-3 ${className}`}>{children}</td>; }

export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    safe: "bg-success/15 text-success",
    review: "bg-warning/15 text-warning",
    fraud: "bg-destructive/15 text-destructive",
    active: "bg-success/15 text-success",
    suspended: "bg-destructive/15 text-destructive",
    open: "bg-destructive/15 text-destructive",
    investigating: "bg-warning/15 text-warning",
    resolved: "bg-success/15 text-success",
  };
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md ${map[s] ?? "bg-secondary text-muted-foreground"}`}>{s}</span>;
}

export function RiskBar({ value }: { value: number }) {
  const color = value > 70 ? "bg-destructive" : value > 40 ? "bg-warning" : "bg-success";
  return (
    <div className="flex items-center gap-2 w-28">
      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden"><div className={`h-full ${color}`} style={{width: `${value}%`}}/></div>
      <span className="text-xs w-6 font-mono">{value}</span>
    </div>
  );
}

function TxModal({ tx, onClose }: any) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} className="glass-strong rounded-2xl max-w-lg w-full p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Transaction</p>
            <p className="font-mono text-lg">{tx.id}</p>
          </div>
          <StatusBadge s={tx.status}/>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-6 text-sm">
          {[
            ["Merchant", tx.merchant], ["Category", tx.category], ["User", tx.user],
            ["Country", tx.country], ["Amount", `$${tx.amount}`], ["Risk score", tx.risk],
            ["Time", new Date(tx.time).toLocaleString()], ["Currency", tx.currency],
          ].map(([k, v]) => (
            <div key={k as string} className="glass rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{k}</p>
              <p className="font-medium mt-0.5">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-2 justify-end">
          <button onClick={onClose} className="glass rounded-lg px-4 py-2 text-sm">Close</button>
          <button className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm">Investigate</button>
        </div>
      </div>
    </div>
  );
}
