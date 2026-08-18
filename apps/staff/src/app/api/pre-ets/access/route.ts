import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  canAccessPreEts,
  canAccessPreEtsAccounts,
  canDeliverPreEtsSessions,
  canManagePreEtsSettings,
  canSupervisePreEts,
  canViewPreEtsHr,
  loadPreEtsSettings,
} from "@wayfinder/supabase/pre-ets-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/pre-ets/access";
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const admin = createServiceRoleClient();
    const settings = await loadPreEtsSettings(admin);
    const role = session.effectiveRole;

    const access = {
      moduleEnabled: settings.module_enabled,
      enabledRoles: settings.enabled_roles,
      canAccess: canAccessPreEts(role, settings),
      canManageSettings: canManagePreEtsSettings(role),
      canAccounts: canAccessPreEtsAccounts(role, settings),
      canSupervise: canSupervisePreEts(role, settings),
      canDeliver: canDeliverPreEtsSessions(role, settings),
      canViewHr: canViewPreEtsHr(role, settings),
    };

    if (!access.canAccess) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      access,
      settings: {
        school_year: settings.school_year,
        module_enabled: settings.module_enabled,
        submission_deadline_hours: settings.submission_deadline_hours,
        ytd_unit_warning_threshold: settings.ytd_unit_warning_threshold,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
