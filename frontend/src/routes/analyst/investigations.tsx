import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/analyst/InvestigationsPage";

export const Route = createFileRoute("/analyst/investigations")({
  component: () => (
    <AnalystShell>
      <Page />
    </AnalystShell>
  ),
});
