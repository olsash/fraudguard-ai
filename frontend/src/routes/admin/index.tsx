import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/AdminDashboardPage";

export const Route = createFileRoute("/admin/")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
