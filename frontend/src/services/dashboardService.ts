import { ApiError, apiGet } from "@/services/api";
import type { DashboardSummary } from "@/types/dashboard";

function toDashboardError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return new Error("Your session has expired. Please sign in again.");
    }

    if (error.status >= 500) {
      return new Error("Dashboard data is unavailable right now. Check that the backend API is running.");
    }

    return new Error(error.message);
  }

  return new Error("Unable to load dashboard data. Check your connection and try again.");
}

export const dashboardService = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      return await apiGet<DashboardSummary>("/dashboard/summary");
    } catch (error) {
      throw toDashboardError(error);
    }
  },
};
