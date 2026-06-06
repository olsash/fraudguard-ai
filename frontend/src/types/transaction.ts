export type TransactionStatus = "pending" | "safe" | "review" | "fraud";
export type FinalTransactionStatus = Exclude<TransactionStatus, "pending">;

export interface Transaction {
  id: number;
  userId: number;
  userName?: string | null;
  merchant: string;
  category: string;
  country: string;
  amount: number;
  currency: string;
  riskScore: number | null;
  status: TransactionStatus;
  transactionType: string;
  createdAt: string;
  description?: string | null;
  latestPredictionId?: number | null;
  latestPredictionExplanation?: string[];
  latestPredictionAt?: string | null;
  latestPredictionConfidence?: number | null;
}

export interface TransactionFilters {
  search?: string;
  status?: "all" | TransactionStatus;
  fromDate?: string;
  toDate?: string;
}

export interface CreateTransactionInput {
  merchant: string;
  category: string;
  country: string;
  amount: number;
  currency: string;
  transactionType: string;
  description?: string | null;
}

export interface TransactionSummary {
  totalTransactions: number;
  safeCount: number;
  reviewCount: number;
  fraudCount: number;
  pendingCount?: number;
  totalAmount: number;
  averageRisk: number;
}
