import { apiGet, apiPatch, apiPost, apiPut } from "@/services/api";
import type { AdminMerchant, UpsertMerchantInput } from "@/types/banking";

export interface AdminMerchantFilters {
  search?: string;
  category?: string;
  bankId?: string;
  riskLevel?: string;
  active?: "all" | "active" | "inactive";
}

function toQuery(filters?: AdminMerchantFilters) {
  if (!filters) {
    return "";
  }

  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set("search", filters.search.trim());
  if (filters.category && filters.category !== "all") params.set("category", filters.category);
  if (filters.bankId && filters.bankId !== "all") params.set("bankId", filters.bankId);
  if (filters.riskLevel && filters.riskLevel !== "all") params.set("riskLevel", filters.riskLevel);
  if (filters.active === "active") params.set("isActive", "true");
  if (filters.active === "inactive") params.set("isActive", "false");

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const adminMerchantService = {
  getMerchants(filters?: AdminMerchantFilters): Promise<AdminMerchant[]> {
    return apiGet<AdminMerchant[]>(`/admin/merchants${toQuery(filters)}`);
  },

  getMerchant(id: number): Promise<AdminMerchant> {
    return apiGet<AdminMerchant>(`/admin/merchants/${id}`);
  },

  createMerchant(payload: UpsertMerchantInput): Promise<AdminMerchant> {
    return apiPost<AdminMerchant>("/admin/merchants", payload);
  },

  updateMerchant(id: number, payload: UpsertMerchantInput): Promise<AdminMerchant> {
    return apiPut<AdminMerchant>(`/admin/merchants/${id}`, payload);
  },

  activate(id: number): Promise<AdminMerchant> {
    return apiPatch<AdminMerchant>(`/admin/merchants/${id}/activate`);
  },

  deactivate(id: number): Promise<AdminMerchant> {
    return apiPatch<AdminMerchant>(`/admin/merchants/${id}/deactivate`);
  },
};
