import type { RecentPrediction } from "@/types/dashboard";

export type AdminUserRole = "User" | "Admin";
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
  status: AdminUserStatus;
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
