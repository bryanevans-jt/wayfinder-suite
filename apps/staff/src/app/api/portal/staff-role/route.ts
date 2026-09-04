import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import { assertStaffUserEditable, upsertStaffProfile } from "@/lib/portal-staff-users";
import { roleDisplayName } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

const FIELD_OR_SUPERVISOR = new Set(["es", "transition_specialist", "supervisor"]);

type Body = {
  user_id?: string;
  /** Target role after convert / promote / demote. */
  role?: "es" | "transition_specialist" | "supervisor";
};

/**
 * Convert among Employment Specialist, Transition Specialist, and Regional Supervisor
 * (Super Admin only). Keeps the same Auth login and es_client_assignments (caseload).
 */
export async function PATCH(request: NextRequest) {
  try {
    const { admin, isSuperAdmin } = await assertPortalMutation("super_admin");
    if (!isSuperAdmin) {
      return Response.json(
        {
          error:
            "Only a Super Admin can change Employment Specialist, Transition Specialist, or Regional Supervisor roles here.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Body;
    const userId = body.user_id?.trim();
    const nextRole = body.role;

    if (!userId) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }
    if (!nextRole || !FIELD_OR_SUPERVISOR.has(nextRole)) {
      return Response.json(
        {
          error:
            "role must be “es”, “transition_specialist”, or “supervisor”.",
        },
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
    if (!FIELD_OR_SUPERVISOR.has(current)) {
      return Response.json(
        {
          error: `Only field specialists and Regional Supervisors can be changed here (current role: ${current || "unknown"}). Use Assign Staff Role by Email for other roles.`,
        },
        { status: 400 }
      );
    }

    if (current === nextRole) {
      return Response.json({ ok: true, unchanged: true, role: nextRole });
    }

    // Leaving supervisor: drop who they supervise (they keep their own client caseload).
    if (current === "supervisor" && nextRole !== "supervisor") {
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
      roleLabel: roleDisplayName(nextRole),
    });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
