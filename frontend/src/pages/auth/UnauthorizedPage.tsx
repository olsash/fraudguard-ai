import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { authService } from "@/services/authService";

function homeForRole() {
  const role = authService.getCurrentRole();
  if (role === "admin") return "/admin" as const;
  if (role === "fraudAnalyst") return "/analyst" as const;
  if (role === "user") return "/app" as const;
  return "/login" as const;
}

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-destructive/15 text-destructive">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-display font-semibold text-foreground">Unauthorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your account does not have permission to open this workspace.
        </p>
        <div className="mt-6">
          <Link
            to={homeForRole()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Return to workspace
          </Link>
        </div>
      </div>
    </div>
  );
}
