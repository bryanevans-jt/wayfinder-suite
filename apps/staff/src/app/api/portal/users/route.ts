import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import {
  assertStaffUserEditable,
  findAuthUserIdByEmail,
  hardDeleteStaffAuthUser,
  inviteStaffAuthUser,
  replaceStaffOfficeAssignments,
  upsertStaffProfile,
} from "@/lib/portal-staff-users";
import {
  isAssignableStaffRole,
  isAdminRole,
  isAccountantRole,
  isHrRole,
  isHospitalitySpecialistRole,
  isSuperAdminRole,
  roleDisplayName,
} from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

function isManagedDirectoryRole(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return (
    isAdminRole(r) ||
    isSuperAdminRole(r) ||
    isAccountantRole(r) ||
    isHrRole(r) ||
    isHospitalitySpecialistRole(r)
  );
}

export async function POST(request: NextRequest) {
  try {
    const { admin, isSuperAdmin } = await assertPortalMutation("super_admin");
    if (!isSuperAdmin) {
      return Response.json({ error: "Only super admin can assign staff roles" }, { status: 403 });
    }

    const body = (await request.json()) as {
      email?: string;
      role?: string;
      full_name?: string;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    const role = (body.role ?? "").trim().toLowerCase();
    const fullName = body.full_name?.trim();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }
    if (!isAssignableStaffRole(role)) {
      return Response.json(
        { error: "Choose a valid staff role to assign." },
        { status: 400 }
      );
    }

    let userId = await findAuthUserIdByEmail(admin, email);

    if (!userId) {
      userId = await inviteStaffAuthUser(
        admin,
        email,
        fullName ? { full_name: fullName } : undefined
      );
    }

    await upsertStaffProfile(admin, userId, {
      role,
      full_name: fullName,
      is_active: true,
      staff_removed_at: null,
    });

    return Response.json({ ok: true, userId, role, roleLabel: roleDisplayName(role) });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, isSuperAdmin } = await assertPortalMutation("admin");

    const body = (await request.json()) as {
      user_id?: string;
      role?: string;
      full_name?: string;
      is_active?: boolean;
    };
    const userId = body.user_id?.trim();
    if (!userId) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }

    const blocked = await assertStaffUserEditable(admin, userId);
    if (blocked) {
      return Response.json({ error: blocked.error }, { status: blocked.status });
    }

    const { data: existing } = await admin
      .from("profiles")
      .select("role, staff_removed_at")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const currentRole = String(existing.role ?? "");
    if (!isManagedDirectoryRole(currentRole)) {
      return Response.json(
        { error: "This account is managed from Team, not Administrators." },
        { status: 400 }
      );
    }

    if (!isSuperAdmin && isSuperAdminRole(currentRole)) {
      return Response.json(
        { error: "Only Super Admin can edit Super Admin accounts." },
        { status: 403 }
      );
    }

    let nextRole = currentRole || "admin";
    if (body.role !== undefined) {
      if (!isSuperAdmin) {
        return Response.json({ error: "Only super admin can change roles" }, { status: 403 });
      }
      const requested = body.role.trim().toLowerCase();
      if (!isAssignableStaffRole(requested) && requested !== "super_admin") {
        return Response.json({ error: "Invalid role" }, { status: 400 });
      }
      nextRole = requested;
    }

    const restoring = body.is_active === true && Boolean(existing.staff_removed_at);

    await upsertStaffProfile(admin, userId, {
      role: nextRole,
      full_name: body.full_name,
      is_active: body.is_active,
      ...(body.is_active === false
        ? { staff_removed_at: new Date().toISOString() }
        : restoring || body.is_active === true
          ? { staff_removed_at: null }
          : {}),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

/** Soft-remove (or permanently delete) Admin / Accounts / HR / Hospitality accounts. */
export async function DELETE(request: NextRequest) {
  try {
    const hard = request.nextUrl.searchParams.get("hard") === "1";
    const { admin, isSuperAdmin } = await assertPortalMutation(hard ? "super_admin" : "admin");
    const userId = request.nextUrl.searchParams.get("user_id")?.trim();

    if (!userId) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
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

    const role = String(profile?.role ?? "");
    if (!isManagedDirectoryRole(role) || isSuperAdminRole(role)) {
      return Response.json(
        {
          error:
            "Only Admin, Accounts Specialist, HR Director, or Hospitality Specialist can be removed here.",
        },
        { status: 400 }
      );
    }

    if (hard) {
      if (!isSuperAdmin) {
        return Response.json(
          { error: "Only a Super Admin can permanently delete this account." },
          { status: 403 }
        );
      }
      await hardDeleteStaffAuthUser(admin, userId);
      return Response.json({ ok: true, hardDeleted: true });
    }

    await replaceStaffOfficeAssignments(admin, userId, []);
    await upsertStaffProfile(admin, userId, {
      role,
      is_active: false,
      staff_removed_at: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
