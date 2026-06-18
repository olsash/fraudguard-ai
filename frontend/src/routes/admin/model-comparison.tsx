import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/AdminModelComparisonPage";

export const Route = createFileRoute("/admin/model-comparison")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
