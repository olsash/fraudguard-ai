export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "https://localhost:5001/api",
  predictionApiUrl:
    import.meta.env.VITE_ML_PREDICTION_API_URL ?? "https://localhost:5001/api/predictions",
};
