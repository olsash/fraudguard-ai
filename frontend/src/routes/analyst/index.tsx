import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/AdminDashboardPage";

export const Route = createFileRoute("/analyst/")({
  component: () => (
    <AnalystShell>
      <Page variant="analyst" />
    </AnalystShell>
  ),
});
