import { Topbar } from "@/components/layout/Topbar";
import { transactions } from "@/data/mockData";
import { StatusBadge, RiskBar, Th, Td } from "@/pages/transactions/TransactionsPage";

export default function AdminTx() {
  return (
    <>
      <Topbar title="Transactions" subtitle="All transactions across the platform"/>
      <main className="flex-1 p-4 md:p-8">
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><Th>ID</Th><Th>Merchant</Th><Th>User</Th><Th>Country</Th><Th>Amount</Th><Th>Risk</Th><Th>Status</Th><Th>Time</Th></tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id} className="border-t border-border hover:bg-secondary/40">
                  <Td><span className="font-mono text-xs">{t.id}</span></Td>
                  <Td>{t.merchant}</Td>
                  <Td>{t.user}</Td>
                  <Td>{t.country}</Td>
                  <Td className="font-mono font-semibold">${t.amount}</Td>
                  <Td><RiskBar value={t.risk}/></Td>
                  <Td><StatusBadge s={t.status}/></Td>
                  <Td className="text-xs text-muted-foreground">{new Date(t.time).toLocaleString()}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}