import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/analyst/AnalystAlertsPage";

export const Route = createFileRoute("/analyst/alerts")({
  component: () => (
    <AnalystShell>
      <Page />
    </AnalystShell>
  ),
});
