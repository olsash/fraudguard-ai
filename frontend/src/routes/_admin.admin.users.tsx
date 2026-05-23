import { createFileRoute } from "@tanstack/react-router";
import { Topbar } from "@/components/topbar";
import { usersList } from "@/lib/mock-data";
import { Search, UserPlus, Trash2, Pencil, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge, RiskBar, Th, Td } from "../routes/_app.app.transactions";

export const Route = createFileRoute("/_admin/admin/users")({
  component: UsersPage,
});

function UsersPage() {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<any>(null);
  const rows = useMemo(()=> usersList.filter(u => (u.name+u.email).toLowerCase().includes(q.toLowerCase())), [q]);
  return (
    <>
      <Topbar title="Users Management" subtitle={`${rows.length} users`}/>
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <div className="glass rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 glass rounded-lg px-3 py-2 flex-1 min-w-[240px]">
            <Search className="h-4 w-4 text-muted-foreground"/>
            <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search users…" className="flex-1 bg-transparent text-sm outline-none"/>
          </div>
          <button className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm flex items-center gap-2"><UserPlus className="h-4 w-4"/> Add user</button>
        </div>

        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><Th>User</Th><Th>Email</Th><Th>Role</Th><Th>Status</Th><Th>Risk activity</Th><Th>Created</Th><Th/></tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id} className="border-t border-border hover:bg-secondary/40">
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gradient-primary grid place-items-center text-xs font-semibold text-primary-foreground">
                        {u.name.split(" ").map(p=>p[0]).slice(0,2).join("")}
                      </div>
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </Td>
                  <Td className="text-muted-foreground">{u.email}</Td>
                  <Td><span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-md ${u.role==="Admin"?"bg-accent/20 text-accent":u.role==="Analyst"?"bg-primary/20 text-primary":"bg-secondary text-muted-foreground"}`}>{u.role}</span></Td>
                  <Td><StatusBadge s={u.status}/></Td>
                  <Td><RiskBar value={u.risk}/></Td>
                  <Td className="text-xs text-muted-foreground">{new Date(u.created).toLocaleDateString()}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <button onClick={()=>setSel(u)} className="h-7 w-7 grid place-items-center rounded hover:bg-secondary"><Pencil className="h-3.5 w-3.5"/></button>
                      <button className="h-7 w-7 grid place-items-center rounded hover:bg-destructive/20 text-destructive"><Trash2 className="h-3.5 w-3.5"/></button>
                      <button onClick={()=>setSel(u)} className="h-7 w-7 grid place-items-center rounded hover:bg-secondary"><ChevronRight className="h-3.5 w-3.5"/></button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      {sel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm grid place-items-center p-4" onClick={()=>setSel(null)}>
          <div onClick={(e)=>e.stopPropagation()} className="glass-strong rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gradient-primary grid place-items-center text-lg font-semibold text-primary-foreground">
                {sel.name.split(" ").map((p:string)=>p[0]).slice(0,2).join("")}
              </div>
              <div>
                <p className="font-display font-semibold text-lg">{sel.name}</p>
                <p className="text-xs text-muted-foreground">{sel.email}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
              {[["Role", sel.role], ["Status", sel.status], ["Risk", sel.risk], ["ID", sel.id]].map(([k,v]) => (
                <div key={k} className="glass rounded-lg p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="font-medium mt-0.5">{v}</p></div>
              ))}
            </div>
            <div className="mt-5 flex gap-2 justify-end">
              <button onClick={()=>setSel(null)} className="glass rounded-lg px-4 py-2 text-sm">Close</button>
              <button className="bg-gradient-primary text-primary-foreground rounded-lg px-4 py-2 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
