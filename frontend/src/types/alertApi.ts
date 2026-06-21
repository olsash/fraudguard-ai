export type AlertSeverity = "critical" | "high" | "medium" | "low";
export type AlertStatus = "open" | "investigating" | "resolved";

export interface FraudAlertRecord {
  id: number;
  userId: number;
  userName?: string | null;
  transactionId?: number | null;
  predictionId?: number | null;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  riskScore: number;
  merchant: string;
  transactionType: string;
  amount: number;
  currency: string;
  country: string;
  shortReason: string;
  createdAt: string;
}
