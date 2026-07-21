export interface FraudCaseSummary {
  openCases: number;
  assignedToMe: number;
  highRiskTransactions: number;
  casesResolvedToday: number;
  averageReviewTimeMinutes: number;
  confirmedFraudCases: number;
}

export interface FraudCase {
  id: number;
  transactionId: number;
  predictionId?: number | null;
  fraudAlertId?: number | null;
  assignedAnalystId?: number | null;
  assignedAnalystName?: string | null;
  customerName: string;
  customerEmail: string;
  merchant: string;
  transactionType: string;
  amount: number;
  currency: string;
  sourceAccount?: string | null;
  beneficiaryName?: string | null;
  modelRiskScore: number;
  modelDecision: string;
  status: string;
  priority: string;
  finalDecision?: string | null;
  analystComment?: string | null;
  modelReasons: string[];
  relatedAlerts: string[];
  createdAt: string;
  assignedAt?: string | null;
  reviewedAt?: string | null;
  resolvedAt?: string | null;
  updatedAt?: string | null;
}

export interface FraudCaseListResponse {
  summary: FraudCaseSummary;
  items: FraudCase[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FraudCaseFilters {
  status?: string;
  priority?: string;
  transactionType?: string;
  minRisk?: string;
  maxRisk?: string;
  assigned?: string;
  fromDate?: string;
  toDate?: string;
  sortBy?: string;
  sortDirection?: string;
  page?: number;
  pageSize?: number;
}
