import type { BackendAuthUser } from "@/services/authService";

export interface ProfileResponse extends BackendAuthUser {
  phoneNumber: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  lastLoginAt: string | null;
}

export interface UpdateProfilePayload {
  fullName: string;
  phoneNumber: string | null;
}
