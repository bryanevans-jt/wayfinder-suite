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
import {
  canUploadPreEtsWorksheets,
  usesPreEtsPlanningWorksheetUpload,
} from "@wayfinder/supabase/pre-ets-upload-scope";
import { isAdminRole, isSuperAdminRole } from "@wayfinder/supabase/roles";
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

    const canAccounts = canAccessPreEtsAccounts(role, settings);
    const canSupervise = canSupervisePreEts(role, settings);

    const access = {
      moduleEnabled: settings.module_enabled,
      enabledRoles: settings.enabled_roles,
      canAccess: canAccessPreEts(role, settings),
      canManageSettings: canManagePreEtsSettings(role),
      canAccounts,
      canSupervise,
      canDeliver: canDeliverPreEtsSessions(role, settings),
      canViewHr: canViewPreEtsHr(role, settings),
      canUploadPlanningWorksheets: canUploadPreEtsWorksheets(role),
      canFinalizeAuthorizations: canAccounts,
      canViewPipeline:
        isSuperAdminRole(role) ||
        isAdminRole(role) ||
        canAccounts ||
        canSupervise,
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
        service_codes: settings.service_codes,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
