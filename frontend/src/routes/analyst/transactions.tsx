import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/analyst/AnalystTransactionsPage";

export const Route = createFileRoute("/analyst/transactions")({
  component: () => (
    <AnalystShell>
      <Page />
    </AnalystShell>
  ),
});
