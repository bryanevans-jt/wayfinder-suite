import { StaffDashboardShell } from "@/components/staff-dashboard-shell";
import { PreviewBanner } from "@/components/preview-banner";
import { TrainingDemoBanner } from "@/components/training-demo-banner";
import { loadCachedFeatureToggles } from "@/lib/feature-toggles";
import { preEtsAccessAllowedForRole } from "@/lib/pre-ets-access";
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
  const [showPreEtsNav, toggles] = await Promise.all([
    preEtsAccessAllowedForRole(navRole),
    loadCachedFeatureToggles().catch(() => null),
  ]);
  const showCommunityPartners = toggles?.communityPartnersEnabled ?? false;
  const hideIntakeCallsNav = toggles?.directReferralAssignEnabled ?? false;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-white">
      {session?.isPreviewing && session.preview ? (
        <PreviewBanner
          targetName={session.preview.targetName}
          targetRole={session.preview.effectiveRole}
          staffAppUrl={staffAppOrigin()}
        />
      ) : null}
      {session?.isTrainingDemoHandoff ? (
        <TrainingDemoBanner targetName={session.trainingTargetName ?? "ES Training Demo"} />
      ) : null}
      <StaffDashboardShell
        staffRole={navRole}
        showAuditLink={showAuditLink}
        showPreEtsNav={showPreEtsNav}
        showCommunityPartners={showCommunityPartners}
        hideIntakeCallsNav={hideIntakeCallsNav}
      >
        {children}
      </StaffDashboardShell>
    </div>
  );
}
