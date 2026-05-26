import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/LogsPage";

export const Route = createFileRoute("/admin/logs")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
