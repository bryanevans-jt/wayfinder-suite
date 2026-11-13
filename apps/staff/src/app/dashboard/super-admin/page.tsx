import { PortalWorkspace } from "@/components/portal-workspace";
import { loadPortalWorkspaceConfig } from "@/lib/portal-data";
import { portalNavFromSearchParams } from "@/lib/portal-nav-url";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuperAdminPortalPage({ searchParams }: PageProps) {
  const initialConfig = await loadPortalWorkspaceConfig("super_admin");
  const params = await searchParams;
  const initialNav = portalNavFromSearchParams(params);

  return (
    <PortalWorkspace
      mode="super_admin"
      title="Super Admin Portal"
      subtitle="Full organization control. Use Billing & modules below for IJP Billing (Drive folders and templates), or open Settings → IJP Billing. The left sidebar Tools section links to the IJP Billing workspace (Generate Invoices)."
      initialNav={initialNav ?? undefined}
      initialConfig={initialConfig}
    />
  );
}
