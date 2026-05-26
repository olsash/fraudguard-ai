import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/reports/ReportsPage";

export const Route = createFileRoute("/app/reports")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
