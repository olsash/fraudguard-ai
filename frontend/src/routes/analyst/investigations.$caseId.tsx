import { createFileRoute } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";
import Page from "@/pages/analyst/InvestigationDetailPage";

export const Route = createFileRoute("/analyst/investigations/$caseId")({
  component: () => {
    const { caseId } = Route.useParams();
    return (
      <AnalystShell>
        <Page caseId={Number(caseId)} />
      </AnalystShell>
    );
  },
});
