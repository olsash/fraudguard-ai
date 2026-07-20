import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/AdminPredictionsPage";

export const Route = createFileRoute("/analyst/predictions")({
  component: () => (
    <AnalystShell>
      <Page />
    </AnalystShell>
  ),
});
