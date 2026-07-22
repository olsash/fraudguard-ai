export interface FraudCaseSummary {
  openCases: number;
  assignedToMe: number;
  highRiskTransactions: number;
  unassignedCases: number;
  underReviewCases: number;
  casesResolvedToday: number;
  averageReviewTimeMinutes: number;
  confirmedFraudCases: number;
  falsePositiveCases: number;
}

export interface FraudCase {
  id: number;
  caseReference: string;
  transactionId: number;
  transactionReference: string;
  predictionId?: number | null;
  fraudAlertId?: number | null;
  assignedAnalystId?: number | null;
  assignedAnalystName?: string | null;
  customerName: string;
  customerEmail: string;
  customerIsActive: boolean;
  customerCreatedAt?: string | null;
  merchant: string;
  merchantCode?: string | null;
  merchantCategory?: string | null;
  merchantCountry?: string | null;
  merchantBankName?: string | null;
  merchantRiskLevel?: string | null;
  maskedMerchantSettlementAccount?: string | null;
  transactionType: string;
  amount: number;
  currency: string;
  sourceAccount?: string | null;
  sourceBank?: string | null;
  sourceIban?: string | null;
  beneficiaryName?: string | null;
  destinationBank?: string | null;
  destinationAccount?: string | null;
  oldBalanceOrigin?: number | null;
  newBalanceOrigin?: number | null;
  oldBalanceDestination?: number | null;
  newBalanceDestination?: number | null;
  processingStatus: string;
  modelRiskScore: number;
  modelDecision: string;
  status: string;
  priority: string;
  finalDecision?: string | null;
  analystDecision?: string | null;
  analystComment?: string | null;
  alertSeverity?: string | null;
  alertStatus?: string | null;
  alertCreatedAt?: string | null;
  modelName?: string | null;
  modelVersion?: string | null;
  predictedClass?: string | null;
  predictionCreatedAt?: string | null;
  canClaim: boolean;
  canReview: boolean;
  modelReasons: string[];
  relatedAlerts: string[];
  notes: FraudCaseNote[];
  createdAt: string;
  assignedAt?: string | null;
  reviewedAt?: string | null;
  reviewStartedAt?: string | null;
  resolvedAt?: string | null;
  updatedAt?: string | null;
}

export interface FraudCaseNote {
  id: number;
  analystId: number;
  analystName: string;
  comment: string;
  createdAt: string;
}

export interface FraudCaseListResponse {
  summary: FraudCaseSummary;
  items: FraudCase[];
  total: number;
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface FraudCaseFilters {
  status?: string;
  priority?: string;
  transactionType?: string;
  search?: string;
  minRisk?: string;
  maxRisk?: string;
  assignment?: string;
  from?: string;
  to?: string;
  sort?: string;
  direction?: string;
  page?: number;
  pageSize?: number;
}
