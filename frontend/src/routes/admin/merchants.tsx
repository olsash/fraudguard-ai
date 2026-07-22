import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/AdminMerchantsPage";

export const Route = createFileRoute("/admin/merchants")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
