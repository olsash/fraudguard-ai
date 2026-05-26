import type { PredictionInput, PredictionResult } from "@/types/prediction";

export const predictionService = {
  predict(input: PredictionInput): Promise<PredictionResult> {
    const amount = Number(input.amount);
    const fraudy = amount > 800 || input.ipRisk === "High" || input.country === "BR";
    const proba = fraudy ? 0.78 + Math.random() * 0.2 : Math.random() * 0.3;

    return Promise.resolve({
      proba,
      fraud: proba > 0.5,
      confidence: 0.85 + Math.random() * 0.14,
      risk: proba > 0.85 ? "Critical" : proba > 0.6 ? "High" : proba > 0.3 ? "Medium" : "Low",
      reasons: fraudy
        ? [
            "High-risk IP segment",
            "Velocity anomaly (12 tx / hr)",
            "Card-not-present in foreign region",
            "Amount above 95th percentile",
          ]
        : ["Behavioral pattern matches history", "Known merchant", "Geo-velocity normal"],
      action:
        proba > 0.85
          ? "Block & require step-up auth"
          : proba > 0.6
            ? "Challenge with 3-D Secure"
            : proba > 0.3
              ? "Allow with monitoring"
              : "Approve",
    });
  },
};
