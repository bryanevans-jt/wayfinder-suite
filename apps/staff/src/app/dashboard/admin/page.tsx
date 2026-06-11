import { PortalWorkspace } from "@/components/portal-workspace";
import { requirePortalPage } from "@/lib/portal-data";

export default async function AdminPortalPage() {
  await requirePortalPage("admin");

  return (
    <PortalWorkspace
      mode="admin"
      title="Admin"
      subtitle="Manage offices, clients, Employment Specialists, counselors, supervisors, assignments, view/export activity logs, and audit client messages — contact logs are read-only at this tier."
    />
  );
}
