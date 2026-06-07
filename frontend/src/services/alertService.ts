import { apiDelete, apiGet, apiPut } from "@/services/api";
import type { AlertStatus, FraudAlertRecord } from "@/types/alertApi";

export const alertService = {
  getAlerts: () => apiGet<FraudAlertRecord[]>("/alerts"),
  getAlert: (id: number) => apiGet<FraudAlertRecord>(`/alerts/${id}`),
  updateStatus: (id: number, status: AlertStatus) =>
    apiPut<FraudAlertRecord>(`/alerts/${id}/status`, { status }),
  deleteAlert: (id: number) =>
    apiDelete<{ message: string }>(`/alerts/${id}`),
};
