import { createFileRoute } from "@tanstack/react-router";

import Page from "@/pages/dashboard/LandingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FraudGuard" },
      { name: "description", content: "Real-time machine learning credit card fraud detection for banks and fintech teams." },
      { property: "og:title", content: "FraudGuard" },
      { property: "og:description", content: "Real-time machine learning fraud prevention with 99.41% accuracy." },
    ],
  }),
  component: Page,
});