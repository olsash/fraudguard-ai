import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/analyst/ReviewQueuePage";

export const Route = createFileRoute("/analyst/review-queue")({
  component: () => (
    <AnalystShell>
      <Page />
    </AnalystShell>
  ),
});
