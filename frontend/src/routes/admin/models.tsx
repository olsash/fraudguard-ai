import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/AdminModelsPage";

export const Route = createFileRoute("/admin/models")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
