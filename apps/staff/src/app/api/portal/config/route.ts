import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import { loadPortalBootstrap } from "@/lib/portal-data";
import { isAdminTierRole, isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const tier = request.nextUrl.searchParams.get("tier") ?? "admin";
    const minTier =
      tier === "super_admin" ? "super_admin" : tier === "supervisor" ? "supervisor" : "admin";

    const { admin, user, role } = await assertPortalSession(minTier);

    let scope: { supervisorUserId?: string; officeIds?: string[]; esUserIds?: string[] } | undefined;

    if (role === "supervisor" && !isAdminTierRole(role)) {
      const [{ data: offices }, { data: esLinks }] = await Promise.all([
        admin.from("staff_office_assignments").select("office_id").eq("user_id", user.id),
        admin.from("supervisor_es_assignments").select("es_user_id").eq("supervisor_user_id", user.id),
      ]);
      scope = {
        supervisorUserId: user.id,
        officeIds: (offices ?? []).map((o) => o.office_id as string),
        esUserIds: (esLinks ?? []).map((e) => e.es_user_id as string),
      };
    }

    const bootstrap = await loadPortalBootstrap(admin, scope);
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
