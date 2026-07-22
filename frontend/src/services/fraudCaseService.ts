import { apiGet, apiPost, apiPut } from "@/services/api";
import type { AnalystTransactionFilters, AnalystTransactionListResponse, FraudCase, FraudCaseFilters, FraudCaseListResponse, FraudCaseSummary } from "@/types/fraudCase";

function toQuery(filters?: FraudCaseFilters) {
  const params = new URLSearchParams();

  Object.entries(filters ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "all") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const fraudCaseService = {
  getSummary(): Promise<FraudCaseSummary> {
    return apiGet<FraudCaseSummary>("/fraud-cases/summary");
  },

  getCases(filters?: FraudCaseFilters): Promise<FraudCaseListResponse> {
    return apiGet<FraudCaseListResponse>(`/analyst/review-queue${toQuery(filters)}`);
  },

  getAnalystAlerts(filters?: FraudCaseFilters): Promise<FraudCaseListResponse> {
    return apiGet<FraudCaseListResponse>(`/analyst/alerts${toQuery(filters)}`);
  },

  getAnalystPredictions(filters?: FraudCaseFilters & { modelResult?: string; riskLevel?: string }): Promise<FraudCaseListResponse> {
    return apiGet<FraudCaseListResponse>(`/analyst/predictions${toQuery(filters)}`);
  },

  getAnalystTransactions(filters?: AnalystTransactionFilters): Promise<AnalystTransactionListResponse> {
    return apiGet<AnalystTransactionListResponse>(`/analyst/transactions${toQuery(filters)}`);
  },

  getCase(id: number): Promise<FraudCase> {
    return apiGet<FraudCase>(`/analyst/cases/${id}`);
  },

  claim(id: number): Promise<FraudCase> {
    return apiPost<FraudCase>(`/analyst/cases/${id}/claim`, {});
  },

  addComment(id: number, comment: string): Promise<FraudCase> {
    return apiPost<FraudCase>(`/analyst/cases/${id}/notes`, { comment });
  },

  approve(id: number, comment?: string): Promise<FraudCase> {
    return apiPost<FraudCase>(`/analyst/cases/${id}/approve`, { comment });
  },

  falsePositive(id: number, comment?: string): Promise<FraudCase> {
    return apiPost<FraudCase>(`/analyst/cases/${id}/false-positive`, { comment });
  },

  confirmFraud(id: number, comment?: string): Promise<FraudCase> {
    return apiPost<FraudCase>(`/analyst/cases/${id}/confirm-fraud`, { comment });
  },

  reject(id: number, comment?: string): Promise<FraudCase> {
    return apiPost<FraudCase>(`/analyst/cases/${id}/resolve`, { finalDecision: "Rejected", comment });
  },

  assign(id: number, analystId: number): Promise<FraudCase> {
    return apiPut<FraudCase>(`/fraud-cases/${id}/assign`, { analystId });
  },
};
