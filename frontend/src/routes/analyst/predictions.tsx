import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/analyst/AnalystPredictionsPage";

export const Route = createFileRoute("/analyst/predictions")({
  component: () => (
    <AnalystShell>
      <Page />
    </AnalystShell>
  ),
});
