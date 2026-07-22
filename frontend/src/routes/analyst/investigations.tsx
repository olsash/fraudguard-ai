import { createFileRoute } from "@tanstack/react-router";
import { Outlet } from "@tanstack/react-router";

import { AnalystShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/analyst/investigations")({
  component: () => (
    <AnalystShell>
      <Outlet />
    </AnalystShell>
  ),
});
