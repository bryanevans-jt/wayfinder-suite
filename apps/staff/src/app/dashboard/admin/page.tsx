import { PortalWorkspace } from "@/components/portal-workspace";
import { loadPortalWorkspaceConfig } from "@/lib/portal-data";

export default async function AdminPortalPage() {
  const initialConfig = await loadPortalWorkspaceConfig("admin");

  return (
    <PortalWorkspace
      mode="admin"
      title="Admin Portal"
      subtitle="Manage clients, team members, offices, and reports. PTO and WRT curriculum live under Settings."
      initialConfig={initialConfig}
    />
  );
}
