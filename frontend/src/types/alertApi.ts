export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertStatus = "open" | "investigating" | "resolved";

export interface FraudAlertRecord {
  id: number;
  userId: number;
  userName?: string | null;
  transactionId: number;
  predictionId?: number | null;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  riskScore: number;
  merchant: string;
  amount: number;
  currency: string;
  country: string;
  createdAt: string;
}
