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
  transactionId?: number | null;
  transactionMerchant?: string | null;
  transactionCountry?: string | null;
  transactionCategory?: string | null;
  transactionCurrency?: string | null;
  transactionCreatedAt?: string | null;
  transactionStatus?: string | null;
  fraudProbability: number;
  riskScore: number;
  riskLevel: PredictionRisk;
  isFraud: boolean;
  predictedClass?: string;
  confidence: number;
  reasons: string[];
  explanationFactors?: string[];
  modelName?: string | null;
  modelTrainingDate?: string | null;
  suggestedAction: string;
  createdAt: string;
}

export interface TransactionPredictionResult {
  transactionId: number;
  predictionId: number;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  status: "safe" | "review" | "fraud";
  confidence: number;
  modelName?: string | null;
  modelTrainingDate?: string | null;
  predictedClass?: string;
  explanation: string[];
  createdAt: string;
}
