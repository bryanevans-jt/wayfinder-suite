import { PortalWorkspace } from "@/components/portal-workspace";
import { requirePortalPage } from "@/lib/portal-data";
import { portalNavFromSearchParams } from "@/lib/portal-nav-url";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SuperAdminPortalPage({ searchParams }: PageProps) {
  await requirePortalPage("super_admin");
  const params = await searchParams;
  const initialNav = portalNavFromSearchParams(params);

  return (
    <PortalWorkspace
      mode="super_admin"
      title="Super Admin Portal"
      subtitle="Full organization control. Use Billing & modules below for IJP Billing (Drive folders and templates), or open Settings → IJP Billing. The left sidebar Tools section links to the IJP Billing workspace for monthly invoices."
      initialNav={initialNav ?? undefined}
    />
  );
}
