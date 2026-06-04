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
  safeTransactions: number;
  fraudTransactions: number;
  averageRiskScore: number;
  highestRiskScore: number;
  latestPrediction: RecentPrediction | null;
  recentPredictions: RecentPrediction[];
  riskDistribution: RiskDistributionPoint[];
  predictionsPerDay: PredictionChartPoint[];
  highRiskCases?: number | null;
  criticalRiskCases?: number | null;
}
