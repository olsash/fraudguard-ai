export type AdminModelStatus = "live" | "idle" | "disabled" | "training" | "benchmarking" | "error";

export interface AdminModelConfusionMatrix {
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  truePositives: number;
}

export interface AdminModel {
  id: string;
  displayName: string;
  version: string;
  status: AdminModelStatus | string;
  isActive: boolean;
  isEnabled: boolean;
  artifactExists: boolean;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  f1Score: number | null;
  rocAuc?: number | null;
  lastTrainedAt?: string | null;
  lastBenchmarkedAt?: string | null;
  artifactPath: string;
  notes?: string | null;
  confusionMatrix?: AdminModelConfusionMatrix | null;
}
