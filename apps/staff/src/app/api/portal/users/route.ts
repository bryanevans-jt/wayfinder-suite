import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { admin, isSuperAdmin } = await assertPortalSession("super_admin");
    if (!isSuperAdmin) {
      return Response.json({ error: "Only super admin can assign admins" }, { status: 403 });
    }

    const body = (await request.json()) as { email?: string; role?: string };
    const email = (body.email ?? "").trim().toLowerCase();
    const role = (body.role ?? "admin").trim().toLowerCase();

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }
    if (role !== "admin") {
      return Response.json({ error: "Super admin can only assign admin role here" }, { status: 400 });
    }

    const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
    let userId = listed.users?.find((u) => (u.email ?? "").toLowerCase() === email)?.id;

    if (!userId) {
      const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email);
      if (inviteErr || !invited.user) {
        throw new Error(inviteErr?.message ?? "Could not invite user");
      }
      userId = invited.user.id;
    }

    const { error: profileErr } = await admin
      .from("profiles")
      .update({ role: "admin", is_active: true })
      .eq("id", userId);

    if (profileErr) {
      const { error: insertErr } = await admin.from("profiles").insert({
        id: userId,
        role: "admin",
        is_active: true,
      });
      if (insertErr) throw new Error(insertErr.message);
    }

    return Response.json({ ok: true, userId });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin, isSuperAdmin } = await assertPortalSession("admin");
    const body = (await request.json()) as {
      user_id?: string;
      role?: string;
      full_name?: string;
      is_active?: boolean;
    };

    const userId = body.user_id?.trim();
    if (!userId) {
      return Response.json({ error: "user_id required" }, { status: 400 });
    }

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!targetProfile) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (targetProfile.role === "super_admin" && !isSuperAdmin) {
      return Response.json({ error: "Only super admin can modify super admin accounts" }, { status: 403 });
    }

    const { data: protectedRow } = await admin
      .from("system_protected_profiles")
      .select("profile_id")
      .eq("profile_id", userId)
      .maybeSingle();

    if (protectedRow) {
      return Response.json({ error: "Protected account cannot be modified" }, { status: 403 });
    }

    const patch: Record<string, unknown> = {};
    if (body.role) patch.role = body.role;
    if (body.full_name !== undefined) patch.full_name = body.full_name;
    if (body.is_active !== undefined) patch.is_active = body.is_active;

    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "Nothing to update" }, { status: 400 });
    }

    if (patch.role === "super_admin") {
      return Response.json({ error: "Cannot promote to super_admin from portal" }, { status: 403 });
    }

    if (patch.role && targetProfile.role === "super_admin") {
      return Response.json({ error: "Cannot change super admin role from portal" }, { status: 403 });
    }

    const { error } = await admin.from("profiles").update(patch).eq("id", userId);
    if (error) throw new Error(error.message);

    if (body.full_name !== undefined) {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { full_name: body.full_name },
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
