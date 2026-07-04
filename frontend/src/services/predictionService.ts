import { apiDownload, apiGet, apiPost } from "@/services/api";
import type {
  PredictionResult,
  TransactionBalanceInput,
  TransactionPredictionResult,
} from "@/types/prediction";

export const predictionService = {
  predictTransaction(transactionId: number, balances?: TransactionBalanceInput): Promise<TransactionPredictionResult> {
    return apiPost<TransactionPredictionResult>(
      `/predictions/predict-transaction/${transactionId}`,
      balances ?? {},
    );
  },

  getMyHistory(): Promise<PredictionResult[]> {
    return apiGet<PredictionResult[]>("/predictions/my");
  },

  getAdminHistory(): Promise<PredictionResult[]> {
    return apiGet<PredictionResult[]>("/predictions/admin");
  },

  exportMyHistory(): Promise<Blob> {
    return apiDownload("/predictions/my/export");
  },

  exportAdminHistory(): Promise<Blob> {
    return apiDownload("/predictions/admin/export");
  },
};
