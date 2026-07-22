import { createFileRoute } from "@tanstack/react-router";

import Page from "@/pages/analyst/InvestigationDetailPage";

export const Route = createFileRoute("/analyst/investigations/$caseId")({
  validateSearch: (search: Record<string, unknown>) => ({
    mode: search.mode === "readonly" ? "readonly" : undefined,
  }),
  component: () => {
    const { caseId } = Route.useParams();
    const { mode } = Route.useSearch();
    return <Page caseId={Number(caseId)} readOnlyRequested={mode === "readonly"} />;
  },
});
