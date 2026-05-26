export type PredictionRisk = "Low" | "Medium" | "High" | "Critical";

export interface PredictionInput {
  amount: string;
  merchant: string;
  category: string;
  country: string;
  device: string;
  txType: string;
  method: string;
  time: string;
  ipRisk: string;
  freq: string;
  pattern: string;
}

export interface PredictionResult {
  proba: number;
  risk: PredictionRisk;
  fraud: boolean;
  confidence: number;
  reasons: string[];
  action: string;
}
