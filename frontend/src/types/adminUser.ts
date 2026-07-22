import type { RecentPrediction } from "@/types/dashboard";

export type AdminUserRole = "User" | "FraudAnalyst" | "Admin";
export type AdminUserStatus = "Active" | "Inactive";

export interface AdminUser {
  id: number;
  fullName: string;
  email: string;
  role: AdminUserRole;
  phoneNumber?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  totalPredictions: number;
  averageRiskScore: number;
  highestRiskScore: number;
  fraudPredictionsCount: number;
  openAssignedCases: number;
  status: AdminUserStatus;
}

export interface AdminUserSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  admins: number;
  fraudAnalysts: number;
  normalUsers: number;
}

export interface AdminUserListResponse {
  items: AdminUser[];
  summary: AdminUserSummary;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface AdminUserDetails extends AdminUser {
  recentPredictions: RecentPrediction[];
}

export interface CreateAdminUserInput {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string | null;
  role: AdminUserRole;
}

export interface UpdateAdminUserInput {
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: AdminUserRole;
  status: AdminUserStatus;
}
