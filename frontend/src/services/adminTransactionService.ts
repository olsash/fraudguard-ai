import { apiGet, apiPost } from "@/services/api";
import type { AdminFilters, AdminPagedResult, AdminTransaction, AdminTransactionAnalysis, AdminTransactionDetail } from "@/types/admin";
import type { TransactionBalanceInput } from "@/types/prediction";

function toQuery(filters?: AdminFilters) {
  const params = new URLSearchParams();

  if (filters?.search) params.set("search", filters.search);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.riskLevel && filters.riskLevel !== "all") params.set("riskLevel", filters.riskLevel);
  if (filters?.transactionType && filters.transactionType !== "all") params.set("transactionType", filters.transactionType);
  if (filters?.fraudStatus && filters.fraudStatus !== "all") params.set("fraudStatus", filters.fraudStatus);
  if (filters?.minAmount) params.set("minAmount", filters.minAmount);
  if (filters?.maxAmount) params.set("maxAmount", filters.maxAmount);
  if (filters?.sortBy) params.set("sortBy", filters.sortBy);
  if (filters?.sortDirection) params.set("sortDirection", filters.sortDirection);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters?.fromDate) params.set("fromDate", filters.fromDate);
  if (filters?.toDate) params.set("toDate", filters.toDate);

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const adminTransactionService = {
  getTransactions(filters?: AdminFilters): Promise<AdminPagedResult<AdminTransaction>> {
    return apiGet<AdminPagedResult<AdminTransaction>>(`/admin/transactions${toQuery(filters)}`);
  },

  getTransactionById(id: number): Promise<AdminTransactionDetail> {
    return apiGet<AdminTransactionDetail>(`/admin/transactions/${id}`);
  },

  analyzeTransaction(id: number, balances?: TransactionBalanceInput): Promise<AdminTransactionAnalysis> {
    return apiPost<AdminTransactionAnalysis>(`/admin/transactions/${id}/analyze`, balances ?? {});
  },
};
