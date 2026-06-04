import { ApiError, apiGet, apiPost, apiPut } from "@/services/api";
import type { AdminUser, AdminUserDetails, CreateAdminUserInput, UpdateAdminUserInput } from "@/types/adminUser";

function toAdminUserError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return new Error("Your session has expired. Please sign in again.");
    }

    if (error.status === 403) {
      return new Error("Admin access required.");
    }

    if (error.status === 400 || error.status === 409 || error.status === 404) {
      return new Error(error.message);
    }

    if (error.status >= 500) {
      return new Error("User management is unavailable right now. Check that the backend API is running.");
    }

    return new Error(error.message);
  }

  return new Error("Unable to contact the user management API. Check your connection and try again.");
}

async function apiDelete(path: string): Promise<void> {
  const { apiConfig } = await import("@/config/apiConfig");
  const { authService } = await import("@/services/authService");
  const token = authService.getToken();

  const response = await fetch(`${apiConfig.baseUrl}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const body = (await response.json()) as { message?: string; errors?: Record<string, string[]> };
      const validationMessages = body.errors ? Object.values(body.errors).flat() : [];
      message = body.message ?? validationMessages[0] ?? message;
    } catch {
      // Empty error bodies use the status fallback.
    }

    throw new ApiError(response.status, message);
  }
}

export const adminUserService = {
  async getUsers(): Promise<AdminUser[]> {
    try {
      return await apiGet<AdminUser[]>("/admin/users");
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
      await apiDelete(`/admin/users/${id}`);
    } catch (error) {
      throw toAdminUserError(error);
    }
  },
};
