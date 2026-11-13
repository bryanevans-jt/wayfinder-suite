import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  authorizationWarningListLabel,
  authorizationWarningTone,
  syncAuthorizationWarningsForClients,
} from "@wayfinder/supabase/authorization-warnings";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { IJP_SIGNATURE_FLAGS_MAX_CLIENT_IDS } from "@/lib/ijp-signature-flags-rate-limit";
import { NextResponse } from "next/server";

export type AuthorizationWarningFlag = {
  label: string;
  tone: "none" | "info" | "warn" | "alert";
};

/**
 * Soft authorization-warning badges for portal / caseload lists.
 * Also runs deduped ES/TS notifications when thresholds are newly crossed.
 */
export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.actorUserId)
    .maybeSingle();
  if (!profile?.is_active) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const role = session.isPreviewing ? session.effectiveRole : (profile.role as string);
  if (!isAdminTierRole(role) && !isSupervisorRole(role) && !isFieldSpecialistRole(role)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const body = (await request.json()) as { clientIds?: string[] };
  const clientIds = [...new Set((body.clientIds ?? []).filter(Boolean))].slice(
    0,
    IJP_SIGNATURE_FLAGS_MAX_CLIENT_IDS
  );
  if (clientIds.length === 0) {
    return NextResponse.json({ flags: {} satisfies Record<string, AuthorizationWarningFlag> });
  }

  const admin = createServiceRoleClient();
  let clientsQuery = await admin
    .from("clients")
    .select(
      "id, full_name, authorized_hours, authorization_end_date, current_service_id"
    )
    .in("id", clientIds);

  if (
    clientsQuery.error &&
    /authorized_hours|authorization_end_date/i.test(clientsQuery.error.message)
  ) {
    return NextResponse.json({ flags: {} });
  }
  if (clientsQuery.error) {
    return NextResponse.json({ error: clientsQuery.error.message }, { status: 500 });
  }

  const serviceIds = [
    ...new Set(
      (clientsQuery.data ?? [])
        .map((r) => r.current_service_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const serviceNameById = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: services } = await admin.from("services").select("id, name").in("id", serviceIds);
    for (const s of services ?? []) {
      serviceNameById.set(s.id as string, s.name as string);
    }
  }

  const evaluations = await syncAuthorizationWarningsForClients(
    admin,
    (clientsQuery.data ?? []).map((row) => ({
      id: row.id as string,
      authorized_hours:
        row.authorized_hours == null ? null : Number(row.authorized_hours),
      authorization_end_date: (row.authorization_end_date as string | null) ?? null,
      serviceName: serviceNameById.get(row.current_service_id as string) ?? null,
      displayName: (row.full_name as string | null) ?? null,
    })),
    { notify: !session.isPreviewing }
  );

  const flags: Record<string, AuthorizationWarningFlag> = {};
  for (const [clientId, evaluation] of evaluations) {
    const label = authorizationWarningListLabel(evaluation);
    if (!label) continue;
    flags[clientId] = {
      label,
      tone: authorizationWarningTone(evaluation),
    };
  }

  return NextResponse.json({ flags });
}
