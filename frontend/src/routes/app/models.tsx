import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/models/ModelsPage";

export const Route = createFileRoute("/app/models")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
