export type FraudAlertSeverity = "critical" | "high" | "medium" | "low";
export type FraudAlertStatus = "open" | "investigating" | "resolved";

export interface FraudAlert {
  id: string;
  severity: FraudAlertSeverity;
  title: string;
  user: string;
  amount: number;
  time: string;
  status: FraudAlertStatus;
}
