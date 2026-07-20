import { Link } from "@tanstack/react-router";
import { AlertTriangle, FileSearch, Radar, Receipt } from "lucide-react";

import { Topbar } from "@/components/layout/Topbar";

const actions = [
  {
    to: "/analyst/review-queue",
    label: "Review Queue",
    description: "Inspect pending and high-risk stored transactions before escalation.",
    icon: Receipt,
  },
  {
    to: "/analyst/alerts",
    label: "Fraud Alerts",
    description: "Track open alerts and update investigation status.",
    icon: AlertTriangle,
  },
  {
    to: "/analyst/predictions",
    label: "Predictions",
    description: "Review model outputs, risk scores, and stored decision reasons.",
    icon: Radar,
  },
];

export default function InvestigationsPage() {
  return (
    <>
      <Topbar title="Investigations" subtitle="Operational fraud review workspace" />
      <main className="flex-1 p-4 md:p-8 space-y-4">
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
              <FileSearch className="h-5 w-5" />
            </div>
            <div>
              <p className="font-display font-semibold">Investigation workflow</p>
              <p className="text-sm text-muted-foreground">
                Use the existing review queues, alert records, and prediction history to investigate suspicious transactions.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {actions.map((action) => (
            <Link key={action.to} to={action.to} className="glass rounded-2xl p-5 transition hover:ring-1 hover:ring-primary/40">
              <action.icon className="h-5 w-5 text-primary" />
              <p className="mt-3 font-display font-semibold">{action.label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
