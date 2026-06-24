import {
  CommunityPartnersWorkspace,
  type EmployerRow,
} from "@/components/community-partners-workspace";
import { COMMUNITY_PARTNERS_NETWORK_NAME } from "@/lib/employer-constants";
import { canEditCommunityPartners, isCommunityPartnersRole } from "@/lib/community-partners-auth";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import { createServerClient } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { loadEmployerLastTouches } from "@/lib/caseload-operations";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

export default async function CommunityPartnersPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  if (!isCommunityPartnersRole(session.effectiveRole)) {
    return (
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold text-brand-black">{COMMUNITY_PARTNERS_NETWORK_NAME}</h1>
        <p className="mt-2 max-w-xl text-brand-black/80">
          The employer directory is available to JTSG staff (Employment Specialists,
          supervisors, accounting, and administrators). Your current role does not include this
          workspace.
        </p>
      </main>
    );
  }

  const supabase = await createServerClient();
  const isAdminTier = isAdminTierRole(session.effectiveRole);

  const canEdit = canEditCommunityPartners(session.effectiveRole);
  const readOnly = session.isPreviewing || !canEdit;

  const [employersQuery, officesQuery] = await Promise.all([
    supabase
      .from("employers")
      .select(
        "id, name, status, industry, contact_name, contact_email, contact_phone, address_line1, city, state, zip, website, office_id, position_need_primary, position_need_primary_other, position_need_secondary, position_need_secondary_other, latitude, longitude, submission_source, offices(name)"
      )
      .order("name", { ascending: true }),
    supabase.from("offices").select("id, name").order("name", { ascending: true }),
  ]);

  const migrationMissing = employersQuery.error?.message.includes("employers");
  const initialEmployers = migrationMissing
    ? []
    : ((employersQuery.data ?? []) as EmployerRow[]);

  let lastTouchByEmployer: Record<string, { touchedAt: string; touchedByName: string | null; outcome: string | null }> = {};
  if (!migrationMissing && initialEmployers.length > 0) {
    try {
      const admin = createServiceRoleClient();
      const touches = await loadEmployerLastTouches(
        admin,
        initialEmployers.map((e) => e.id)
      );
      lastTouchByEmployer = Object.fromEntries(
        [...touches.entries()].map(([id, t]) => [
          id,
          { touchedAt: t.touchedAt, touchedByName: t.touchedByName, outcome: t.outcome },
        ])
      );
    } catch {
      lastTouchByEmployer = {};
    }
  }

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold text-brand-black">{COMMUNITY_PARTNERS_NETWORK_NAME}</h1>
        <p className="mt-2 text-sm text-brand-black/75">
          Maintain hiring partners your team works with — contacts, locations, and relationship
          status. Use list view for details or map view to see partners across Georgia and
          Tennessee. Link applications to these employers from client records as you build out
          placements.
        </p>
        {isAdminTier ? (
          <p className="mt-2 text-sm text-brand-black/65">
            Public join link:{" "}
            <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs">
              /community-partners/join
            </code>
          </p>
        ) : null}
        {migrationMissing ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Database migration required: run{" "}
            <code className="rounded bg-white px-1">20250530000000_community_partners_network.sql</code>{" "}
            (and prior employer migrations) in Supabase.
          </p>
        ) : null}
      </header>

      <CommunityPartnersWorkspace
        offices={(officesQuery.data ?? []) as { id: string; name: string }[]}
        readOnly={readOnly}
        readOnlyReason={session.isPreviewing ? "preview" : "role"}
        isAdminTier={isAdminTier}
        initialEmployers={initialEmployers}
        lastTouchByEmployer={lastTouchByEmployer}
      />
    </main>
  );
}
