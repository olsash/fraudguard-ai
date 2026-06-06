import { Topbar } from "@/components/layout/Topbar";
import { predictionService } from "@/services/predictionService";
import type { PredictionResult } from "@/types/prediction";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { RiskBar, StatusBadge, Td, Th } from "@/pages/transactions/TransactionsPage";

export default function AdminPredictionsPage() {
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        setPredictions(await predictionService.getAdminHistory());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load predictions.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  return (
    <>
      <Topbar title="Predictions" subtitle="Linked transaction prediction history" />
      <main className="flex-1 p-4 md:p-8">
        {loading && (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-primary" /> Loading predictions...
          </div>
        )}
        {!loading && error && (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">{error}</div>
        )}
        {!loading && !error && (
          <div className="glass rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[980px]">
                <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr><Th>ID</Th><Th>Transaction</Th><Th>Country</Th><Th>Amount</Th><Th>Risk</Th><Th>Status</Th><Th>Created</Th></tr>
                </thead>
                <tbody>
                  {predictions.length === 0 ? (
                    <tr className="border-t border-border"><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No predictions found.</td></tr>
                  ) : predictions.map((prediction) => (
                    <tr key={prediction.id} className="border-t border-border hover:bg-secondary/40">
                      <Td><span className="font-mono text-xs">PR-{prediction.id}</span></Td>
                      <Td>{prediction.transactionMerchant ?? (prediction.transactionId ? `TX-${prediction.transactionId}` : prediction.transactionType)}</Td>
                      <Td>{prediction.transactionCountry ?? "-"}</Td>
                      <Td className="font-mono font-semibold">{formatCurrency(prediction.amount)}</Td>
                      <Td><RiskBar value={prediction.riskScore} /></Td>
                      <Td><StatusBadge s={prediction.transactionStatus ?? (prediction.isFraud ? "fraud" : "safe")} /></Td>
                      <Td className="text-xs text-muted-foreground">{new Date(prediction.createdAt).toLocaleString()}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
