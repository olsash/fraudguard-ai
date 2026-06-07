import { Topbar } from "@/components/layout/Topbar";
import { AlertsWorkspace } from "@/components/alerts/AlertsWorkspace";

export default function AlertsPage() {
  return (
    <>
      <Topbar title="Fraud Alert Center" subtitle="Transaction risk triage" />
      <main className="flex-1 p-4 md:p-8">
        <AlertsWorkspace />
      </main>
    </>
  );
}
