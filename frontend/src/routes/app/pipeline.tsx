import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/models/PipelinePage";

export const Route = createFileRoute("/app/pipeline")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
