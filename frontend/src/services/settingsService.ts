import { apiDelete, apiPut } from "@/services/api";

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

interface SettingsMessageResponse {
  message: string;
}

export const settingsService = {
  changePassword: (payload: ChangePasswordPayload) =>
    apiPut<SettingsMessageResponse>("/settings/change-password", payload),
  deleteAccount: () =>
    apiDelete<SettingsMessageResponse>("/settings/account"),
};
