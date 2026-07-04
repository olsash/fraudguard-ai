import type { TransactionStatus } from "@/types/transaction";

export type AdminRiskLevel = "all" | "low" | "medium" | "high";
export type AdminPredictionResultFilter = "all" | "fraud" | "not_fraud";
export type AdminTransactionTypeFilter = "all" | "CASH_IN" | "CASH_OUT" | "DEBIT" | "PAYMENT" | "TRANSFER";
export type AdminFraudStatusFilter = "all" | "fraud" | "not_fraud";
export type AdminTransactionSortBy = "date" | "amount" | "riskScore";
export type AdminSortDirection = "asc" | "desc";

export interface AdminFilters {
  search?: string;
  status?: "all" | TransactionStatus;
  riskLevel?: AdminRiskLevel;
  predictionResult?: AdminPredictionResultFilter;
  transactionType?: AdminTransactionTypeFilter;
  fraudStatus?: AdminFraudStatusFilter;
  minAmount?: string;
  maxAmount?: string;
  sortBy?: AdminTransactionSortBy;
  sortDirection?: AdminSortDirection;
  page?: number;
  pageSize?: number;
  fromDate?: string;
  toDate?: string;
}

export interface AdminPagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AdminTransaction {
  id: number;
  userId: number;
  userName: string;
  userEmail?: string | null;
  merchant: string;
  country: string;
  category: string;
  amount: number;
  oldBalanceOrigin?: number | null;
  newBalanceOrigin?: number | null;
  oldBalanceDestination?: number | null;
  newBalanceDestination?: number | null;
  currency: string;
  transactionType: string;
  riskScore: number | null;
  status: TransactionStatus;
  createdAt: string;
  predictionId?: number | null;
}

export interface AdminPredictionSummary {
  id: number;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  status: TransactionStatus;
  factors: string[];
  suggestedAction: string;
  confidence: number;
  createdAt: string;
}

export interface AdminAlertSummary {
  id: number;
  severity: string;
  status: string;
  createdAt: string;
}

export interface AdminTransactionDetail extends AdminTransaction {
  description?: string | null;
  prediction?: AdminPredictionSummary | null;
  alert?: AdminAlertSummary | null;
}

export interface AdminPrediction {
  id: number;
  transactionId?: number | null;
  transactionMerchant: string;
  userId: number;
  userName: string;
  userEmail?: string | null;
  country: string;
  category: string;
  amount: number;
  currency: string;
  transactionType: string;
  riskScore: number;
  riskLevel: "Low" | "Medium" | "High";
  status: TransactionStatus;
  createdAt: string;
  factors: string[];
  modelName: string;
}

export interface AdminPredictionDetail extends AdminPrediction {
  transaction?: {
    id: number;
    merchant: string;
    country: string;
    category: string;
    amount: number;
    oldBalanceOrigin?: number | null;
    newBalanceOrigin?: number | null;
    oldBalanceDestination?: number | null;
    newBalanceDestination?: number | null;
    currency: string;
    transactionType: string;
    createdAt: string;
  } | null;
  user: {
    id: number;
    name: string;
    email?: string | null;
  };
  suggestedAction: string;
  confidence: number;
  decisionSummary: string;
  alert?: AdminAlertSummary | null;
}

export interface AdminTransactionAnalysis {
  transaction: AdminTransactionDetail;
  prediction: AdminPredictionDetail;
  alertCreated: boolean;
}
