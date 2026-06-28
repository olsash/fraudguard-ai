import { fraudTrend, geoFraud, volumeData } from "@/data/fraudVisualizationData";

export const reportService = {
  getFraudTrend: () => fraudTrend,
  getVolumeData: () => volumeData,
  getGeoFraud: () => geoFraud,
};
