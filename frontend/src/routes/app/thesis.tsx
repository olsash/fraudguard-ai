import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/reports/ThesisPage";

export const Route = createFileRoute("/app/thesis")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
