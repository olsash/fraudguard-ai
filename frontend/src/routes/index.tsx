import { createFileRoute } from "@tanstack/react-router";

import Page from "@/pages/dashboard/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FraudGuard-AI" },
      { name: "description", content: "Online payment fraud detection using machine learning, ASP.NET Core ONNX inference, Python training, and React/Vite." },
      { property: "og:title", content: "FraudGuard-AI" },
      { property: "og:description", content: "Full-stack FraudGuard-AI workspace for fraud prediction, history, alerts, reports, and model comparison." },
    ],
  }),
  component: Page,
});
