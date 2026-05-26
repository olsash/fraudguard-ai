import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/predictions/PredictionPage";

export const Route = createFileRoute("/app/predict")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
