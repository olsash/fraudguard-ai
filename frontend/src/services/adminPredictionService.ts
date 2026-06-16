import { apiGet } from "@/services/api";
import type { AdminFilters, AdminPrediction, AdminPredictionDetail } from "@/types/admin";

function toQuery(filters?: AdminFilters & { userId?: number }) {
  const params = new URLSearchParams();

  if (filters?.search) params.set("search", filters.search);
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.riskLevel && filters.riskLevel !== "all") params.set("riskLevel", filters.riskLevel);
  if (filters?.fromDate) params.set("fromDate", filters.fromDate);
  if (filters?.toDate) params.set("toDate", filters.toDate);
  if (filters?.userId) params.set("userId", String(filters.userId));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const adminPredictionService = {
  getPredictions(filters?: AdminFilters & { userId?: number }): Promise<AdminPrediction[]> {
    return apiGet<AdminPrediction[]>(`/admin/predictions${toQuery(filters)}`);
  },

  getPredictionById(id: number): Promise<AdminPredictionDetail> {
    return apiGet<AdminPredictionDetail>(`/admin/predictions/${id}`);
  },
};
