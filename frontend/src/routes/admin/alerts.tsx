import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/AdminAlertsPage";

export const Route = createFileRoute("/admin/alerts")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
