import { alerts } from "@/data/mockData";

export const alertService = {
  getAlerts: () => alerts,
  getAlertById: (id: string) => alerts.find((alert) => alert.id === id),
};
