import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import {
  assertStaffUserEditable,
  findAuthUserIdByEmail,
  hardDeleteStaffAuthUser,
  provisionStaffAuthUser,
  replaceStaffOfficeAssignments,
  softRemoveEmploymentSpecialist,
  upsertStaffProfile,
} from "@/lib/portal-staff-users";
import { isFieldSpecialistRole } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

type FieldSpecialistRole = "es" | "transition_specialist";

type CreateBody = {
  email?: string;
  full_name?: string;
  office_ids?: string[];
  silent_add?: boolean;
  /** Defaults to es; may be transition_specialist when specified. */
  role?: FieldSpecialistRole;
};

type PatchBody = {
  user_id?: string;
  full_name?: string;
  is_active?: boolean;
  office_ids?: string[];
};

function resolveCreateRole(raw: unknown): FieldSpecialistRole {
  return raw === "transition_specialist" ? "transition_specialist" : "es";
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("admin");
    const body = (await request.json()) as CreateBody;

    const email = (body.email ?? "").trim().toLowerCase();
    const fullName = (body.full_name ?? "").trim();
    const officeIds = (body.office_ids ?? []).map((id) => id.trim()).filter(Boolean);
    const silentAdd = body.silent_add === true;
    const createRole = resolveCreateRole(body.role);

    if (!email || !fullName) {
      return Response.json({ error: "Email and full name are required" }, { status: 400 });
    }

    let userId = await findAuthUserIdByEmail(admin, email);

    if (!userId) {
      userId = await provisionStaffAuthUser(
        admin,
        email,
        { full_name: fullName },
        { sendInvite: !silentAdd }
      );
    } else {
      const blocked = await assertStaffUserEditable(admin, userId);
      if (blocked) {
        return Response.json({ error: blocked.error }, { status: blocked.status });
      }

      const { data: existing } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      const role = existing?.role as string | undefined;
      if (role && !["es", "transition_specialist", "client"].includes(role)) {
        return Response.json(
          {
            error: `This account already has the “${role}” role and cannot be converted to a field specialist here.`,
          },
          { status: 409 }
        );
      }
    }

    await upsertStaffProfile(admin, userId, {
      role: createRole,
      full_name: fullName,
      is_active: silentAdd ? false : true,
    });

    if (officeIds.length > 0) {
      await replaceStaffOfficeAssignments(admin, userId, officeIds);
    }

    return Response.json({ ok: true, userId });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, isSuperAdmin } = await assertPortalMutation("admin");
    const body = (await request.json()) as PatchBody;
    const userId = body.user_id?.trim();

    if (!userId) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    const blocked = await assertStaffUserEditable(admin, userId);
    if (blocked) {
      return Response.json({ error: blocked.error }, { status: blocked.status });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role, is_active, staff_removed_at")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || !isFieldSpecialistRole(profile.role)) {
      return Response.json({ error: "User is not a Field Specialist" }, { status: 400 });
    }

    const specialistRole = (profile.role === "transition_specialist"
      ? "transition_specialist"
      : "es") as FieldSpecialistRole;

    const wasInactive = profile.is_active === false;
    const wasRemoved = Boolean(profile.staff_removed_at);
    if (body.is_active === true && wasRemoved && !isSuperAdmin) {
      return Response.json(
        {
          error:
            "Only a Super Admin can restore a removed Field Specialist. Ask a Super Admin to bring them back.",
        },
        { status: 403 }
      );
    }

    if (body.full_name !== undefined || body.is_active !== undefined) {
      const fullName = body.full_name?.trim();
      if (body.full_name !== undefined && !fullName) {
        return Response.json({ error: "Full name cannot be empty" }, { status: 400 });
      }

      // Deactivating via Edit mirrors Remove: unassign caseload so clients are Unassigned.
      if (body.is_active === false && !wasInactive) {
        await softRemoveEmploymentSpecialist(admin, userId);
        if (body.full_name !== undefined) {
          await upsertStaffProfile(admin, userId, {
            role: specialistRole,
            full_name: fullName,
            is_active: false,
            staff_removed_at: new Date().toISOString(),
          });
        }
        if (body.office_ids !== undefined) {
          await replaceStaffOfficeAssignments(
            admin,
            userId,
            body.office_ids.map((id) => id.trim()).filter(Boolean)
          );
        }
        return Response.json({ ok: true });
      }

      await upsertStaffProfile(admin, userId, {
        role: specialistRole,
        ...(body.full_name !== undefined ? { full_name: fullName } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
        ...(body.is_active === true ? { staff_removed_at: null } : {}),
      });
    }

    if (body.office_ids !== undefined) {
      await replaceStaffOfficeAssignments(
        admin,
        userId,
        body.office_ids.map((id) => id.trim()).filter(Boolean)
      );
    }

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const hard = request.nextUrl.searchParams.get("hard") === "1";
    const { admin, isSuperAdmin } = await assertPortalMutation(hard ? "super_admin" : "admin");
    const userId = request.nextUrl.searchParams.get("user_id")?.trim();

    if (!userId) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    if (hard && !isSuperAdmin) {
      return Response.json(
        { error: "Only a Super Admin can permanently delete a Field Specialist." },
        { status: 403 }
      );
    }

    const blocked = await assertStaffUserEditable(admin, userId);
    if (blocked) {
      return Response.json({ error: blocked.error }, { status: blocked.status });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!isFieldSpecialistRole(profile?.role)) {
      return Response.json({ error: "User is not a Field Specialist" }, { status: 400 });
    }

    if (hard) {
      await hardDeleteStaffAuthUser(admin, userId);
      return Response.json({ ok: true, hardDeleted: true });
    }

    const { unassignedClients } = await softRemoveEmploymentSpecialist(admin, userId);
    return Response.json({ ok: true, unassignedClients });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
