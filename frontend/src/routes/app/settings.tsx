import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/settings/SettingsPage";

export const Route = createFileRoute("/app/settings")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
