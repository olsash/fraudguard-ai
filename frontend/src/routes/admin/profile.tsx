import { createFileRoute } from "@tanstack/react-router";

import { AdminShell } from "@/components/layout/AppShell";
import Page from "@/pages/auth/ProfilePage";

export const Route = createFileRoute("/admin/profile")({
  component: () => (
    <AdminShell>
      <Page />
    </AdminShell>
  ),
});
