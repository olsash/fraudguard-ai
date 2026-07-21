export type TransactionStatus = "pending" | "safe" | "review" | "fraud";
export type TransactionProcessingStatus = "PendingAnalysis" | "PendingReview" | "Completed" | "Rejected" | "Failed";
export type FinalTransactionStatus = Exclude<TransactionStatus, "pending">;

export interface Transaction {
  id: number;
  userId: number;
  userName?: string | null;
  sourceBankAccountId?: number | null;
  sourceAccount?: string | null;
  beneficiaryId?: number | null;
  beneficiaryName?: string | null;
  merchantId?: number | null;
  merchant: string;
  category: string;
  country: string;
  amount: number;
  oldBalanceOrigin?: number | null;
  newBalanceOrigin?: number | null;
  oldBalanceDestination?: number | null;
  newBalanceDestination?: number | null;
  currency: string;
  riskScore: number | null;
  status: TransactionStatus;
  processingStatus: TransactionProcessingStatus;
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
  sourceBankAccountId?: number | null;
  beneficiaryId?: number | null;
  merchantId?: number | null;
  merchant?: string | null;
  category?: string | null;
  country?: string | null;
  amount: number;
  currency: string;
  transactionType: string;
  description?: string | null;
  idempotencyKey?: string | null;
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
