import { apiGet, apiPost } from "@/services/api";
import type { PredictionInput, PredictionResult, TransactionPredictionResult } from "@/types/prediction";

export const predictionService = {
  predict(input: PredictionInput): Promise<PredictionResult> {
    return apiPost<PredictionResult>("/predictions", input);
  },

  predictTransaction(transactionId: number): Promise<TransactionPredictionResult> {
    return apiPost<TransactionPredictionResult>(`/predictions/predict-transaction/${transactionId}`, {});
  },

  getMyHistory(): Promise<PredictionResult[]> {
    return apiGet<PredictionResult[]>("/predictions/my");
  },

  getAdminHistory(): Promise<PredictionResult[]> {
    return apiGet<PredictionResult[]>("/predictions/admin");
  },
};
