import { apiGet, apiPost, apiPut } from "@/services/api";
import type { CreateTransactionInput, Transaction, TransactionFilters, TransactionStatus, TransactionSummary } from "@/types/transaction";

function toQuery(filters?: TransactionFilters) {
  const params = new URLSearchParams();

  if (filters?.search) params.set("search", filters.search);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.fromDate) params.set("fromDate", filters.fromDate);
  if (filters?.toDate) params.set("toDate", filters.toDate);

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const transactionService = {
  getTransactions(filters?: TransactionFilters): Promise<Transaction[]> {
    return apiGet<Transaction[]>(`/transactions${toQuery(filters)}`);
  },

  getTransactionById(id: number): Promise<Transaction> {
    return apiGet<Transaction>(`/transactions/${id}`);
  },

  createTransaction(payload: CreateTransactionInput): Promise<Transaction> {
    return apiPost<Transaction>("/transactions", payload);
  },

  updateTransactionStatus(id: number, status: TransactionStatus): Promise<Transaction> {
    return apiPut<Transaction>(`/transactions/${id}/status`, { status });
  },

  getTransactionSummary(filters?: TransactionFilters): Promise<TransactionSummary> {
    return apiGet<TransactionSummary>(`/transactions/summary${toQuery(filters)}`);
  },
};
