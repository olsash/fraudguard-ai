import { createFileRoute } from "@tanstack/react-router";

import Page from "@/pages/auth/ForgotPasswordPage";

export const Route = createFileRoute("/forgot-password")({
  component: Page,
});
