import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import { loadPortalBootstrap } from "@/lib/portal-data";
import { loadSupervisorScope } from "@/lib/supervisor-client-scope";
import { isAdminTierRole, isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const tier = request.nextUrl.searchParams.get("tier") ?? "admin";
    const minTier =
      tier === "super_admin" ? "super_admin" : tier === "supervisor" ? "supervisor" : "admin";

    const { admin, user, role } = await assertPortalSession(minTier);

    let scope: { supervisorUserId?: string; officeIds?: string[]; esUserIds?: string[] } | undefined;

    if (role === "supervisor" && !isAdminTierRole(role)) {
      const supervisorScope = await loadSupervisorScope(admin, user.id);
      scope = {
        supervisorUserId: supervisorScope.supervisorUserId,
        officeIds: supervisorScope.officeIds,
        esUserIds: supervisorScope.esUserIds,
      };
    }

    const bootstrap = await loadPortalBootstrap(admin, scope, {
      includeHiddenOffices: isSuperAdminRole(role),
    });
    return Response.json({
      bootstrap,
      canEditLogs: isSuperAdminRole(role),
      canAssignAdmins: isSuperAdminRole(role),
      role,
    });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
