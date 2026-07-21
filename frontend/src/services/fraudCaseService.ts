import { apiGet, apiPost, apiPut } from "@/services/api";
import type { FraudCase, FraudCaseFilters, FraudCaseListResponse, FraudCaseSummary } from "@/types/fraudCase";

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
    return apiGet<FraudCaseListResponse>(`/fraud-cases${toQuery(filters)}`);
  },

  getCase(id: number): Promise<FraudCase> {
    return apiGet<FraudCase>(`/fraud-cases/${id}`);
  },

  claim(id: number): Promise<FraudCase> {
    return apiPost<FraudCase>(`/fraud-cases/${id}/claim`, {});
  },

  markUnderReview(id: number): Promise<FraudCase> {
    return apiPost<FraudCase>(`/fraud-cases/${id}/under-review`, {});
  },

  addComment(id: number, comment: string): Promise<FraudCase> {
    return apiPost<FraudCase>(`/fraud-cases/${id}/comment`, { comment });
  },

  approve(id: number, comment?: string): Promise<FraudCase> {
    return apiPost<FraudCase>(`/fraud-cases/${id}/approve`, { comment });
  },

  confirmFraud(id: number, comment?: string): Promise<FraudCase> {
    return apiPost<FraudCase>(`/fraud-cases/${id}/confirm-fraud`, { comment });
  },

  reject(id: number, comment?: string): Promise<FraudCase> {
    return apiPost<FraudCase>(`/fraud-cases/${id}/resolve`, { finalDecision: "Rejected", comment });
  },

  escalate(id: number): Promise<FraudCase> {
    return apiPost<FraudCase>(`/fraud-cases/${id}/escalate`, {});
  },

  assign(id: number, analystId: number): Promise<FraudCase> {
    return apiPut<FraudCase>(`/fraud-cases/${id}/assign`, { analystId });
  },
};
