import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/accounts/AccountsPage";

export const Route = createFileRoute("/app/accounts")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
