import { PortalWorkspace } from "@/components/portal-workspace";
import { requirePortalPage } from "@/lib/portal-data";

export default async function SuperAdminPortalPage() {
  await requirePortalPage("super_admin");

  return (
    <PortalWorkspace
      mode="super_admin"
      title="Super Admin"
      subtitle="Full organization control. Clients is your home tab; PTO, WRT, payroll, demos, and error logs live under Settings."
    />
  );
}
