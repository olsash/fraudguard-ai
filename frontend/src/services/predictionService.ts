import { apiGet, apiPost } from "@/services/api";
import type { PredictionInput, PredictionResult } from "@/types/prediction";

export const predictionService = {
  predict(input: PredictionInput): Promise<PredictionResult> {
    return apiPost<PredictionResult>("/predictions", input);
  },

  getMyHistory(): Promise<PredictionResult[]> {
    return apiGet<PredictionResult[]>("/predictions/my");
  },

  getAdminHistory(): Promise<PredictionResult[]> {
    return apiGet<PredictionResult[]>("/predictions/admin");
  },
};
