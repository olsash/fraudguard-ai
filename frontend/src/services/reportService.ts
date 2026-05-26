import { fraudTrend, geoFraud, volumeData } from "@/data/mockData";

export const reportService = {
  getFraudTrend: () => fraudTrend,
  getVolumeData: () => volumeData,
  getGeoFraud: () => geoFraud,
};
