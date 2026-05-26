import { models, rocData } from "@/data/mockData";

export const modelService = {
  getModels: () => models,
  getRocData: () => rocData,
  getBestModel: () => models.find((model) => model.best) ?? models[0],
};
