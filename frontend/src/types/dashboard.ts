import type { PredictionRisk, TransactionType } from "@/types/prediction";

export interface RecentPrediction {
  id: number;
  userId: number;
  userEmail?: string | null;
  transactionType: TransactionType;
  amount: number;
  riskScore: number;
  riskLevel: PredictionRisk;
  isFraud: boolean;
  suggestedAction: string;
  createdAt: string;
}

export interface RecentTransaction {
  id: number;
  userId: number;
  merchant: string;
  category: string;
  country: string;
  amount: number;
  currency: string;
  riskScore: number | null;
  status: "pending" | "safe" | "review" | "fraud";
  transactionType: string;
  createdAt: string;
}

export interface RiskDistributionPoint {
  riskLevel: PredictionRisk;
  count: number;
}

export interface PredictionChartPoint {
  date: string;
  total: number;
  safe: number;
  fraud: number;
}

export interface DashboardSummary {
  totalUsers?: number | null;
  totalPredictions: number;
  fraudPredictions: number;
  nonFraudPredictions: number;
  totalTransactions: number;
  pendingTransactions: number;
  safeTransactions: number;
  reviewTransactions: number;
  fraudTransactions: number;
  averageRiskScore: number;
  highestRiskScore: number;
  highRiskAlerts: number;
  mostCommonTransactionType: string;
  latestPrediction: RecentPrediction | null;
  recentPredictions: RecentPrediction[];
  recentTransactions: RecentTransaction[];
  riskDistribution: RiskDistributionPoint[];
  predictionsPerDay: PredictionChartPoint[];
  highRiskCases?: number | null;
  criticalRiskCases?: number | null;
}
