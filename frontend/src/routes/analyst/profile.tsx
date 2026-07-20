import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/auth/ProfilePage";

export const Route = createFileRoute("/analyst/profile")({
  component: () => (
    <AnalystShell>
      <Page />
    </AnalystShell>
  ),
});
