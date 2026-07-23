import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isEsRole,
  isHrRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { createServerClient } from "@wayfinder/supabase";
import { NextResponse } from "next/server";

export type AnalyticsScope =
  | { kind: "org" }
  | { kind: "supervisor"; esUserIds: string[]; officeIds: string[] }
  | { kind: "es"; esUserId: string };

export type AnalyticsSession = {
  admin: ReturnType<typeof createServiceRoleClient>;
  actorUserId: string;
  effectiveUserId: string;
  role: string;
  scope: AnalyticsScope;
  readOnly: boolean;
};

export async function assertAnalyticsSession(): Promise<
  { error: NextResponse } | AnalyticsSession
> {
  const session = await getAppSession();
  if (!session) {
    return { error: NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 }) };
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.actorUserId)
    .maybeSingle();

  if (!profile?.is_active) {
    return { error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }) };
  }

  const role = (
    session.isPreviewing ? session.effectiveRole : profile.role
  ) as string;
  const effectiveUserId = session.effectiveUserId;

  let admin: ReturnType<typeof createServiceRoleClient>;
  try {
    admin = createServiceRoleClient();
  } catch {
    return {
      error: NextResponse.json(
        { error: "Analytics requires server configuration." },
        { status: 503 }
      ),
    };
  }

  if (isAdminTierRole(role)) {
    return {
      admin,
      actorUserId: session.actorUserId,
      effectiveUserId,
      role,
      scope: { kind: "org" },
      readOnly: session.isPreviewing,
    };
  }

  if (isHrRole(role)) {
    return {
      admin,
      actorUserId: session.actorUserId,
      effectiveUserId,
      role,
      scope: { kind: "org" },
      readOnly: true,
    };
  }

  if (isSupervisorRole(role)) {
    const [{ data: officeLinks }, { data: esLinks }] = await Promise.all([
      admin.from("staff_office_assignments").select("office_id").eq("user_id", effectiveUserId),
      admin
        .from("supervisor_es_assignments")
        .select("es_user_id")
        .eq("supervisor_user_id", effectiveUserId),
    ]);
    return {
      admin,
      actorUserId: session.actorUserId,
      effectiveUserId,
      role,
      scope: {
        kind: "supervisor",
        officeIds: (officeLinks ?? []).map((o) => o.office_id as string),
        esUserIds: (esLinks ?? []).map((l) => l.es_user_id as string),
      },
      readOnly: session.isPreviewing,
    };
  }

  if (isEsRole(role)) {
    return {
      admin,
      actorUserId: session.actorUserId,
      effectiveUserId,
      role,
      scope: { kind: "es", esUserId: effectiveUserId },
      readOnly: session.isPreviewing,
    };
  }

  return { error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }) };
}

export function esUserIdAllowed(scope: AnalyticsScope, esUserId: string | null): boolean {
  if (!esUserId) {
    return true;
  }
  if (scope.kind === "org") {
    return true;
  }
  if (scope.kind === "es") {
    return esUserId === scope.esUserId;
  }
  return scope.esUserIds.includes(esUserId);
}

export function officeIdAllowed(scope: AnalyticsScope, officeId: string | null): boolean {
  if (!officeId) {
    return true;
  }
  if (scope.kind === "org") {
    return true;
  }
  if (scope.kind === "es") {
    return true;
  }
  return scope.officeIds.includes(officeId);
}
