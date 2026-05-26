import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/AdminSettingsPage";

export const Route = createFileRoute("/admin/settings")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
