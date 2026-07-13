import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import {
  assertStaffUserEditable,
  findAuthUserIdByEmail,
  inviteStaffAuthUser,
  upsertStaffProfile,
} from "@/lib/portal-staff-users";
import { isAssignableStaffRole, roleDisplayName } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

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
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    let nextRole = (existing.role as string) ?? "admin";
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

    await upsertStaffProfile(admin, userId, {
      role: nextRole,
      full_name: body.full_name,
      is_active: body.is_active,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
