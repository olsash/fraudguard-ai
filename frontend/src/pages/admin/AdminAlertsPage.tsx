import { Topbar } from "@/components/layout/Topbar";
import { AlertsWorkspace } from "@/components/alerts/AlertsWorkspace";

export default function AdminAlerts() {
  return (
    <>
      <Topbar title="Fraud Alerts" subtitle="Operations security center" />
      <main className="flex-1 p-4 md:p-8">
        <AlertsWorkspace admin />
      </main>
    </>
  );
}
