export interface FraudAlertRecord {
  id: number;
  userId: number;
  userName?: string | null;
  transactionId: number;
  predictionId?: number | null;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "investigating" | "resolved";
  riskScore: number;
  merchant: string;
  amount: number;
  currency: string;
  country: string;
  createdAt: string;
}
