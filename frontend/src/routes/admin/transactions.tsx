import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/AdminTransactionsPage";

export const Route = createFileRoute("/admin/transactions")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
