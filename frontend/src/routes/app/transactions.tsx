import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/transactions/TransactionsPage";

export const Route = createFileRoute("/app/transactions")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
