import { apiDownload, apiGet, apiPost } from "@/services/api";
import type {
  PredictionInput,
  PredictionResult,
  TransactionPredictionResult,
} from "@/types/prediction";

export const predictionService = {
  predict(input: PredictionInput): Promise<PredictionResult> {
    return apiPost<PredictionResult>("/predictions", input);
  },

  advancedTest(input: PredictionInput): Promise<PredictionResult> {
    return apiPost<PredictionResult>("/predictions/advanced-test", {
      transactionType: input.transactionType,
      amount: input.amount,
      oldBalanceOrg: input.oldBalanceOrigin,
      newBalanceOrig: input.newBalanceOrigin,
      oldBalanceDest: input.oldBalanceDestination,
      newBalanceDest: input.newBalanceDestination,
    });
  },

  predictTransaction(transactionId: number): Promise<TransactionPredictionResult> {
    return apiPost<TransactionPredictionResult>(
      `/predictions/predict-transaction/${transactionId}`,
      {},
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
