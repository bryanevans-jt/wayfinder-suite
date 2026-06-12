import { PortalWorkspace } from "@/components/portal-workspace";
import { requirePortalPage } from "@/lib/portal-data";

export default async function AdminPortalPage() {
  await requirePortalPage("admin");

  return (
    <PortalWorkspace
      mode="admin"
      title="Admin"
      subtitle="Manage clients, team members, offices, and reports. Day-to-day work starts on the Clients tab."
    />
  );
}
