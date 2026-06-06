import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/AdminPredictionsPage";

export const Route = createFileRoute("/admin/predictions")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
