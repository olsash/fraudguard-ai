import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/analyst/AnalystDashboardPage";

export const Route = createFileRoute("/analyst/")({
  component: () => (
    <AnalystShell>
      <Page />
    </AnalystShell>
  ),
});
