import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import {
  assertStaffUserEditable,
  releaseStaffCaseloadAssignments,
  upsertStaffProfile,
} from "@/lib/portal-staff-users";
import { roleDisplayName } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

const FIELD_OR_SUPERVISOR = new Set(["es", "transition_specialist", "supervisor"]);
const CONVERTIBLE_FIELD_ROLES = new Set([...FIELD_OR_SUPERVISOR, "instructor"]);

type Body = {
  user_id?: string;
  /** Target role after convert / promote / demote. */
  role?: "es" | "transition_specialist" | "supervisor" | "instructor";
};

/**
 * Convert among Employment Specialist, Transition Specialist, Transition Instructor, and Regional Supervisor
 * (Super Admin only). Keeps the same Auth login; moving to Transition Instructor releases vocational caseload.
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
    if (!nextRole || !CONVERTIBLE_FIELD_ROLES.has(nextRole)) {
      return Response.json(
        {
          error:
            "role must be “es”, “transition_specialist”, “supervisor”, or “instructor” (Transition Instructor).",
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
    if (!CONVERTIBLE_FIELD_ROLES.has(current)) {
      return Response.json(
        {
          error: `Only field specialists, Transition Instructors, and Regional Supervisors can be changed here (current role: ${current || "unknown"}). Use Assign Staff Role by Email for other roles.`,
        },
        { status: 400 }
      );
    }

    if (current === nextRole) {
      return Response.json({ ok: true, unchanged: true, role: nextRole });
    }

    if (nextRole === "instructor" && current !== "transition_specialist") {
      return Response.json(
        {
          error:
            "Only Transition Specialists can be moved to Transition Instructor here. Choose one person from the Field Specialists list.",
        },
        { status: 400 }
      );
    }

    if (current === "instructor" && nextRole !== "transition_specialist") {
      return Response.json(
        {
          error:
            "Transition Instructors can only be moved back to Transition Specialist from here (Pre-ETS-only vs vocational caseload).",
        },
        { status: 400 }
      );
    }

    let caseloadRelease: Awaited<ReturnType<typeof releaseStaffCaseloadAssignments>> | null = null;
    if (nextRole === "instructor") {
      caseloadRelease = await releaseStaffCaseloadAssignments(admin, userId, {
        reassignToSupervisor: true,
      });
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
      caseloadRelease,
    });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
