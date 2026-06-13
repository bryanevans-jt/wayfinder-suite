import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import {
  findAuthUserIdByEmail,
  inviteStaffAuthUser,
  upsertStaffProfile,
} from "@/lib/portal-staff-users";
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

    let userId = await findAuthUserIdByEmail(admin, email);

    if (!userId) {
      userId = await inviteStaffAuthUser(admin, email);
    }

    await upsertStaffProfile(admin, userId, {
      role: "admin",
      is_active: true,
    });

    return Response.json({ ok: true, userId });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
