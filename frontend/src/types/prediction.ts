export type TransactionType = "CASH_IN" | "CASH_OUT" | "DEBIT" | "PAYMENT" | "TRANSFER";
export type PredictionRisk = "Low" | "Medium" | "High" | "Critical";

export interface PredictionInput {
  transactionType: TransactionType;
  amount: number;
  oldBalanceOrigin: number;
  newBalanceOrigin: number;
  oldBalanceDestination: number;
  newBalanceDestination: number;
}

export interface PredictionResult extends PredictionInput {
  id: number;
  userId: number;
  fraudProbability: number;
  riskScore: number;
  riskLevel: PredictionRisk;
  isFraud: boolean;
  confidence: number;
  reasons: string[];
  suggestedAction: string;
  createdAt: string;
}
