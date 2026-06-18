import { apiGet } from "@/services/api";
import type { ModelComparisonResults } from "@/types/modelComparison";

export const adminModelComparisonService = {
  getModelComparison(): Promise<ModelComparisonResults> {
    return apiGet<ModelComparisonResults>("/admin/model-comparison");
  },
};
