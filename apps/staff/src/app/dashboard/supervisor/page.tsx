import { PortalWorkspace } from "@/components/portal-workspace";
import { loadPortalWorkspaceConfig } from "@/lib/portal-data";

export default async function SupervisorPortalPage() {
  const initialConfig = await loadPortalWorkspaceConfig("supervisor");

  return (
    <PortalWorkspace
      mode="supervisor"
      title="Regional Supervisor Portal"
      subtitle="View clients and Employment Specialists in your scope, review connections, and export activity logs."
      initialConfig={initialConfig}
    />
  );
}
