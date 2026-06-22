export interface ModelHyperparameters {
  tested: Record<string, unknown>;
  selected: Record<string, unknown>;
}

export interface ModelConfusionMatrix {
  trueNegatives: number;
  falsePositives: number;
  falseNegatives: number;
  truePositives: number;
}

export interface ModelComparisonItem {
  modelName: string;
  classifierName?: string;
  modelType: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  rocAuc?: number | null;
  averagePrecision?: number | null;
  confusionMatrix?: ModelConfusionMatrix | null;
  status: string;
  shortDescription: string;
  isBestModel?: boolean;
  hyperparameters?: ModelHyperparameters | null;
  selectedHyperparameters?: Record<string, unknown> | null;
}

export interface ModelComparisonResults {
  datasetName: string;
  problemType: string;
  targetVariable: string;
  bestModelName: string;
  bestModelReason: string;
  evaluationSource?: Record<string, unknown> | null;
  models: ModelComparisonItem[];
}
