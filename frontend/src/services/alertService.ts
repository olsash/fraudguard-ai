import { apiGet } from "@/services/api";
import type { FraudAlertRecord } from "@/types/alertApi";

export const alertService = {
  getAlerts: () => apiGet<FraudAlertRecord[]>("/alerts"),
};
