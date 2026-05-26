import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/auth/ProfilePage";

export const Route = createFileRoute("/app/profile")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
