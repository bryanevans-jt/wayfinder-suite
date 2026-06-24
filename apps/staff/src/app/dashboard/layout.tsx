import { PwaInstallPrompt } from "@wayfinder/branding";
import { StaffDashboardShell } from "@/components/staff-dashboard-shell";
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
      <StaffDashboardShell staffRole={navRole} showAuditLink={showAuditLink}>
        <div className="px-4 pt-4 sm:px-6">
          <PwaInstallPrompt />
        </div>
        {children}
      </StaffDashboardShell>
    </div>
  );
}
