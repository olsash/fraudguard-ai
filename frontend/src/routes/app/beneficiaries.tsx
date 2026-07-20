import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/layout/AppShell";
import Page from "@/pages/beneficiaries/BeneficiariesPage";

export const Route = createFileRoute("/app/beneficiaries")({
  component: () => (
    <AppShell>
      <Page />
    </AppShell>
  ),
});
