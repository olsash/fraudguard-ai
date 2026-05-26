import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/alerts/AlertsPage";

export const Route = createFileRoute("/app/alerts")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
