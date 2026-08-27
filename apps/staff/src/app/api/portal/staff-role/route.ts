import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import { assertStaffUserEditable, upsertStaffProfile } from "@/lib/portal-staff-users";
import { NextRequest } from "next/server";

type Body = {
  user_id?: string;
  /** Target role after promote/demote. */
  role?: "es" | "supervisor";
};

/**
 * Promote ES → Supervisor or demote Supervisor → ES (Super Admin only).
 * Keeps the same Auth login and es_client_assignments (caseload).
 */
export async function PATCH(request: NextRequest) {
  try {
    const { admin, isSuperAdmin } = await assertPortalMutation("super_admin");
    if (!isSuperAdmin) {
      return Response.json(
        { error: "Only a Super Admin can promote or demote Employment Specialists and supervisors." },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Body;
    const userId = body.user_id?.trim();
    const nextRole = body.role;

    if (!userId) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }
    if (nextRole !== "es" && nextRole !== "supervisor") {
      return Response.json(
        { error: "role must be “es” or “supervisor”." },
        { status: 400 }
      );
    }

    const blocked = await assertStaffUserEditable(admin, userId);
    if (blocked) {
      return Response.json({ error: blocked.error }, { status: blocked.status });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role, is_active, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const current = String(profile.role ?? "").toLowerCase();
    if (current !== "es" && current !== "supervisor") {
      return Response.json(
        {
          error: `Only Employment Specialists and supervisors can be promoted or demoted here (current role: ${current || "unknown"}).`,
        },
        { status: 400 }
      );
    }

    if (current === nextRole) {
      return Response.json({ ok: true, unchanged: true, role: nextRole });
    }

    // Demoting a supervisor: drop who they supervise (they keep their own client caseload).
    if (current === "supervisor" && nextRole === "es") {
      const { count: esCount } = await admin
        .from("supervisor_es_assignments")
        .select("id", { count: "exact", head: true })
        .eq("supervisor_user_id", userId);

      if ((esCount ?? 0) > 0) {
        await admin.from("supervisor_es_assignments").delete().eq("supervisor_user_id", userId);
      }
    }

    await upsertStaffProfile(admin, userId, {
      role: nextRole,
      full_name: (profile.full_name as string | null) ?? undefined,
      is_active: profile.is_active !== false,
    });

    return Response.json({
      ok: true,
      role: nextRole,
      previousRole: current,
    });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
