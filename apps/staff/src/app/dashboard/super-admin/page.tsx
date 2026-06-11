import { PortalWorkspace } from "@/components/portal-workspace";
import { requirePortalPage } from "@/lib/portal-data";

export default async function SuperAdminPortalPage() {
  await requirePortalPage("super_admin");

  return (
    <PortalWorkspace
      mode="super_admin"
      title="Super admin"
      subtitle="Full control: offices, clients, Employment Specialists, counselors, supervisors, staff assignments, activity logs (including edit/delete contact logs), message audit and retention purge, and admin invitations. Your account is protected from deletion."
    />
  );
}
