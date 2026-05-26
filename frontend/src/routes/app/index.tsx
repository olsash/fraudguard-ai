import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/dashboard/DashboardPage";

export const Route = createFileRoute("/app/")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
