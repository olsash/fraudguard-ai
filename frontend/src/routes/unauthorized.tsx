import { createFileRoute } from "@tanstack/react-router";

import Page from "@/pages/auth/UnauthorizedPage";

export const Route = createFileRoute("/unauthorized")({
  component: Page,
});
