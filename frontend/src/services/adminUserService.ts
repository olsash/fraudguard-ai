import { ApiError, apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/services/api";
import type { AdminUser, AdminUserDetails, AdminUserListResponse, CreateAdminUserInput, UpdateAdminUserInput } from "@/types/adminUser";

function toAdminUserError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return new Error("Your session has expired. Please sign in again.");
    }

    if (error.status === 403) {
      return new Error("Your account does not have permission to manage users.");
    }

    if (error.status === 404) {
      return new Error("The user-management endpoint could not be found.");
    }

    if (error.status === 400 || error.status === 409) {
      return new Error(error.message);
    }

    if (error.status >= 500) {
      return new Error("User management could not be loaded due to a server error.");
    }

    return new Error(error.message);
  }

  return new Error("The backend API could not be reached.");
}

export const adminUserService = {
  async getUsers(): Promise<AdminUserListResponse> {
    try {
      return await apiGet<AdminUserListResponse>("/admin/users");
    } catch (error) {
      throw toAdminUserError(error);
    }
  },

  async getUserById(id: number): Promise<AdminUserDetails> {
    try {
      return await apiGet<AdminUserDetails>(`/admin/users/${id}`);
    } catch (error) {
      throw toAdminUserError(error);
    }
  },

  async createUser(data: CreateAdminUserInput): Promise<AdminUser> {
    try {
      return await apiPost<AdminUser>("/admin/users", data);
    } catch (error) {
      throw toAdminUserError(error);
    }
  },

  async updateUser(id: number, data: UpdateAdminUserInput): Promise<AdminUser> {
    try {
      return await apiPut<AdminUser>(`/admin/users/${id}`, data);
    } catch (error) {
      throw toAdminUserError(error);
    }
  },

  async deleteUser(id: number): Promise<void> {
    try {
      await apiDelete<void>(`/admin/users/${id}`);
    } catch (error) {
      throw toAdminUserError(error);
    }
  },

  async deactivateUser(id: number): Promise<AdminUser> {
    try {
      return await apiPatch<AdminUser>(`/admin/users/${id}/deactivate`);
    } catch (error) {
      throw toAdminUserError(error);
    }
  },

  async activateUser(id: number): Promise<AdminUser> {
    try {
      return await apiPatch<AdminUser>(`/admin/users/${id}/activate`);
    } catch (error) {
      throw toAdminUserError(error);
    }
  },
};
