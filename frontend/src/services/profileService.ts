import { apiGet, apiPut } from "@/services/api";
import type { ProfileResponse, UpdateProfilePayload } from "@/types/profile";

export const profileService = {
  getMyProfile: () => apiGet<ProfileResponse>("/profile/me"),
  updateMyProfile: (payload: UpdateProfilePayload) =>
    apiPut<ProfileResponse>("/profile/me", payload),
};
