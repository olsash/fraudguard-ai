import { createFileRoute } from "@tanstack/react-router";

import Page from "@/pages/auth/LoginPage";

export const Route = createFileRoute("/login")({
  component: Page,
});
