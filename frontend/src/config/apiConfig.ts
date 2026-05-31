export const apiConfig = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api",
  predictionApiUrl:
    import.meta.env.VITE_ML_PREDICTION_API_URL ?? "http://localhost:5000/api/predictions",
};
