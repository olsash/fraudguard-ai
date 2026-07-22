import { createFileRoute } from "@tanstack/react-router";

import Page from "@/pages/analyst/InvestigationsPage";

export const Route = createFileRoute("/analyst/investigations/")({
  component: Page,
});
