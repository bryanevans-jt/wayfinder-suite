import { StaffSidebar } from "@/components/staff-sidebar";
import { PreviewBanner } from "@/components/preview-banner";
import { getAppSession, staffAppOrigin } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getAppSession();

  const navRole = session?.effectiveRole ?? null;
  const showAuditLink = Boolean(
    session && isSuperAdminRole(session.actorRole) && !session.isPreviewing
  );

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-white">
      {session?.isPreviewing && session.preview ? (
        <PreviewBanner
          targetName={session.preview.targetName}
          targetRole={session.preview.effectiveRole}
          staffAppUrl={staffAppOrigin()}
        />
      ) : null}
      <div className="flex min-h-0 flex-1">
        <StaffSidebar staffRole={navRole} showAuditLink={showAuditLink} />
        <div className="min-w-0 flex-1 bg-white">{children}</div>
      </div>
    </div>
  );
}
