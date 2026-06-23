import { apiGet, apiPost } from "@/services/api";
import type { AdminModel } from "@/types/adminModel";

export const adminModelsApi = {
  getModels(): Promise<AdminModel[]> {
    return apiGet<AdminModel[]>("/admin/models");
  },

  getModel(id: string): Promise<AdminModel> {
    return apiGet<AdminModel>(`/admin/models/${id}`);
  },

  runBenchmark(id: string): Promise<AdminModel> {
    return apiPost<AdminModel>(`/admin/models/${id}/benchmark`, {});
  },

  retrainModel(id: string): Promise<AdminModel> {
    return apiPost<AdminModel>(`/admin/models/${id}/retrain`, {});
  },

  enableModel(id: string): Promise<AdminModel> {
    return apiPost<AdminModel>(`/admin/models/${id}/enable`, {});
  },

  disableModel(id: string): Promise<AdminModel> {
    return apiPost<AdminModel>(`/admin/models/${id}/disable`, {});
  },

  activateModel(id: string): Promise<AdminModel> {
    return apiPost<AdminModel>(`/admin/models/${id}/activate`, {});
  },
};
