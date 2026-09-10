import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import {
  assertStaffUserEditable,
  findAuthUserIdByEmail,
  provisionStaffAuthUser,
  replaceStaffOfficeAssignments,
  upsertStaffProfile,
} from "@/lib/portal-staff-users";
import { isGvraSupervisorRole } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

type CreateBody = {
  email?: string;
  full_name?: string;
  office_ids?: string[];
  silent_add?: boolean;
};

type PatchBody = {
  user_id?: string;
  full_name?: string;
  is_active?: boolean;
  office_ids?: string[];
};

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("admin");
    const body = (await request.json()) as CreateBody;

    const email = (body.email ?? "").trim().toLowerCase();
    const fullName = (body.full_name ?? "").trim();
    const officeIds = (body.office_ids ?? []).map((id) => id.trim()).filter(Boolean);
    const silentAdd = body.silent_add === true;

    if (!email || !fullName) {
      return Response.json({ error: "Email and full name are required" }, { status: 400 });
    }
    if (officeIds.length === 0) {
      return Response.json({ error: "At least one GVRA office is required" }, { status: 400 });
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
      if (role && !["gvra_supervisor", "client"].includes(role)) {
        return Response.json(
          {
            error: `This account already has the “${role}” role and cannot be converted to GVRA Supervisor here.`,
          },
          { status: 409 }
        );
      }
    }

    await upsertStaffProfile(admin, userId, {
      role: "gvra_supervisor",
      full_name: fullName,
      is_active: true,
    });

    await replaceStaffOfficeAssignments(admin, userId, officeIds);

    return Response.json({ ok: true, userId });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("admin");
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
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!isGvraSupervisorRole(profile?.role)) {
      return Response.json({ error: "User is not a GVRA Supervisor" }, { status: 400 });
    }

    if (body.full_name !== undefined || body.is_active !== undefined) {
      const fullName = body.full_name?.trim();
      if (body.full_name !== undefined && !fullName) {
        return Response.json({ error: "Full name cannot be empty" }, { status: 400 });
      }
      await upsertStaffProfile(admin, userId, {
        role: "gvra_supervisor",
        ...(body.full_name !== undefined ? { full_name: fullName } : {}),
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      });
    }

    if (body.office_ids !== undefined) {
      const officeIds = body.office_ids.map((id) => id.trim()).filter(Boolean);
      if (officeIds.length === 0) {
        return Response.json({ error: "At least one GVRA office is required" }, { status: 400 });
      }
      await replaceStaffOfficeAssignments(admin, userId, officeIds);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin } = await assertPortalMutation("admin");
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

    if (!isGvraSupervisorRole(profile?.role)) {
      return Response.json({ error: "User is not a GVRA Supervisor" }, { status: 400 });
    }

    await replaceStaffOfficeAssignments(admin, userId, []);
    await upsertStaffProfile(admin, userId, {
      role: "gvra_supervisor",
      is_active: false,
    });

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
