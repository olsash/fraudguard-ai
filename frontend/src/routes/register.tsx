import { createFileRoute } from "@tanstack/react-router";

import Page from "@/pages/auth/RegisterPage";

export const Route = createFileRoute("/register")({
  component: Page,
});
