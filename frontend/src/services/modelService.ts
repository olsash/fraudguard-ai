import { models, rocData } from "@/data/fraudVisualizationData";

export const modelService = {
  getModels: () => models,
  getRocData: () => rocData,
  getBestModel: () => models.find((model) => model.best) ?? models[0],
};
