import { apiDelete, apiGet } from "@/services/api";

export type SystemLogLevel = "all" | "Info" | "Warning" | "Error" | "Success";
export type SystemLogSource = "all" | "auth" | "api" | "admin" | "prediction" | "transaction" | "alert" | "profile" | "settings";

export interface SystemLog {
  id: number;
  level: Exclude<SystemLogLevel, "all">;
  source: Exclude<SystemLogSource, "all">;
  message: string;
  userId?: number | null;
  userName?: string | null;
  method?: string | null;
  path?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface SystemLogFilters {
  search?: string;
  level?: SystemLogLevel;
  source?: SystemLogSource;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PagedSystemLogs {
  items: SystemLog[];
  totalCount: number;
  page: number;
  pageSize: number;
}

function toQuery(filters?: SystemLogFilters) {
  const params = new URLSearchParams();

  if (filters?.search) params.set("search", filters.search);
  if (filters?.level && filters.level !== "all") params.set("level", filters.level);
  if (filters?.source && filters.source !== "all") params.set("source", filters.source);
  if (filters?.fromDate) params.set("fromDate", filters.fromDate);
  if (filters?.toDate) params.set("toDate", filters.toDate);
  if (filters?.page) params.set("page", String(filters.page));
  if (filters?.pageSize) params.set("pageSize", String(filters.pageSize));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export const adminLogService = {
  getLogs(filters?: SystemLogFilters): Promise<PagedSystemLogs> {
    return apiGet<PagedSystemLogs>(`/admin/logs${toQuery(filters)}`);
  },

  clearLogs(): Promise<{ message: string }> {
    return apiDelete<{ message: string }>("/admin/logs/clear");
  },
};
