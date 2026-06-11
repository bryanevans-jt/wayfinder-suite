import { PortalWorkspace } from "@/components/portal-workspace";
import { requirePortalPage } from "@/lib/portal-data";

export default async function SupervisorPortalPage() {
  await requirePortalPage("supervisor");

  return (
    <PortalWorkspace
      mode="supervisor"
      title="Supervisor"
      subtitle="View clients and Employment Specialists in your scope, review assignments, and export filtered activity logs. Supervisors oversee ES — not counselors."
    />
  );
}
