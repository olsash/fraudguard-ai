import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/admin/UsersPage";

export const Route = createFileRoute("/admin/users")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
