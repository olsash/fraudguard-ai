import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/reports/ReportsPage";

export const Route = createFileRoute("/analyst/reports")({
  component: () => (
    <AnalystShell>
      <Page />
    </AnalystShell>
  ),
});
