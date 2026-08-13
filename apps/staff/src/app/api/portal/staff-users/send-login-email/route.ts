import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import { findAuthUserIdByEmail, sendStaffLoginEmail } from "@/lib/portal-staff-users";
import { NextRequest } from "next/server";

const ALLOWED_ROLES = new Set(["es", "supervisor"]);

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("admin");
    const body = (await request.json()) as { user_id?: string; role?: string };
    const userId = body.user_id?.trim();
    const role = body.role?.trim().toLowerCase();

    if (!userId) {
      return Response.json({ error: "user_id is required" }, { status: 400 });
    }
    if (!role || !ALLOWED_ROLES.has(role)) {
      return Response.json({ error: "role must be es or supervisor" }, { status: 400 });
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) throw new Error(profileErr.message);
    if (profile?.role !== role) {
      return Response.json({ error: "User role does not match" }, { status: 400 });
    }

    const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId);
    if (authErr) throw new Error(authErr.message);

    const email = authUser.user?.email?.trim().toLowerCase() ?? "";
    if (!email) {
      return Response.json({ error: "This user has no email on file" }, { status: 400 });
    }

    const resolvedId = await findAuthUserIdByEmail(admin, email);
    if (!resolvedId) {
      return Response.json({ error: "No Wayfinder login exists for that email" }, { status: 400 });
    }

    await sendStaffLoginEmail(admin, email);
    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
