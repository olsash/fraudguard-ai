import { apiGet, apiPost } from "@/services/api";
import type { AdminFilters, AdminTransaction, AdminTransactionAnalysis, AdminTransactionDetail } from "@/types/admin";

function toQuery(filters?: AdminFilters) {
  const params = new URLSearchParams();

  if (filters?.search) params.set("search", filters.search);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.riskLevel && filters.riskLevel !== "all") params.set("riskLevel", filters.riskLevel);
  if (filters?.fromDate) params.set("fromDate", filters.fromDate);
  if (filters?.toDate) params.set("toDate", filters.toDate);

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const adminTransactionService = {
  getTransactions(filters?: AdminFilters): Promise<AdminTransaction[]> {
    return apiGet<AdminTransaction[]>(`/admin/transactions${toQuery(filters)}`);
  },

  getTransactionById(id: number): Promise<AdminTransactionDetail> {
    return apiGet<AdminTransactionDetail>(`/admin/transactions/${id}`);
  },

  analyzeTransaction(id: number): Promise<AdminTransactionAnalysis> {
    return apiPost<AdminTransactionAnalysis>(`/admin/transactions/${id}/analyze`, {});
  },
};
