import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import {
  assertStaffUserEditable,
  countClientsForCounselor,
  findAuthUserIdByEmail,
  replaceCounselorOfficeAssignments,
  upsertStaffProfile,
} from "@/lib/portal-staff-users";
import { NextRequest } from "next/server";

type CreateBody = {
  full_name?: string;
  email?: string;
  office_ids?: string[];
};

type PatchBody = {
  id?: string;
  full_name?: string;
  email?: string;
  is_active?: boolean;
  office_ids?: string[];
};

async function linkCounselorLogin(
  admin: Awaited<ReturnType<typeof assertPortalSession>>["admin"],
  counselorId: string,
  email: string,
  fullName: string
): Promise<string> {
  let userId = await findAuthUserIdByEmail(admin, email);

  if (!userId) {
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName },
    });
    if (inviteErr || !invited.user) {
      throw new Error(inviteErr?.message ?? "Could not invite user");
    }
    userId = invited.user.id;
  } else {
    const blocked = await assertStaffUserEditable(admin, userId);
    if (blocked) {
      throw new Error(blocked.error);
    }

    const { data: existing } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    const role = existing?.role as string | undefined;
    if (role && !["counselor", "client"].includes(role)) {
      throw new Error(`This account already has the “${role}” role and cannot be converted to counselor.`);
    }
  }

  await upsertStaffProfile(admin, userId, {
    role: "counselor",
    full_name: fullName,
    is_active: true,
  });

  const { error: linkErr } = await admin
    .from("counselors")
    .update({ user_id: userId })
    .eq("id", counselorId);
  if (linkErr && !linkErr.message.includes("Could not find the 'user_id'")) {
    throw new Error(linkErr.message);
  }

  return userId;
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("admin");
    const body = (await request.json()) as CreateBody;

    const fullName = (body.full_name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const officeIds = (body.office_ids ?? []).map((id) => id.trim()).filter(Boolean);

    if (!fullName || !email) {
      return Response.json({ error: "Full name and email are required" }, { status: 400 });
    }
    if (officeIds.length === 0) {
      return Response.json({ error: "At least one office is required" }, { status: 400 });
    }

    const { data: counselor, error: insertErr } = await admin
      .from("counselors")
      .insert({ full_name: fullName, office_id: officeIds[0] })
      .select("id")
      .single();

    if (insertErr || !counselor?.id) {
      throw new Error(insertErr?.message ?? "Could not create counselor");
    }

    const counselorId = counselor.id as string;

    try {
      await linkCounselorLogin(admin, counselorId, email, fullName);
      await replaceCounselorOfficeAssignments(admin, counselorId, officeIds);
    } catch (error) {
      await admin.from("counselors").delete().eq("id", counselorId);
      throw error;
    }

    return Response.json({ ok: true, id: counselorId });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("admin");
    const body = (await request.json()) as PatchBody;
    const id = body.id?.trim();

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    let counselorsQuery = await admin
      .from("counselors")
      .select("id, full_name, user_id")
      .eq("id", id)
      .maybeSingle();
    if (counselorsQuery.error?.message.includes("user_id")) {
      counselorsQuery = await admin
        .from("counselors")
        .select("id, full_name")
        .eq("id", id)
        .maybeSingle();
    }

    const counselor = counselorsQuery.data;
    if (!counselor) {
      return Response.json({ error: "Counselor not found" }, { status: 404 });
    }

    const fullName =
      body.full_name !== undefined ? body.full_name.trim() : (counselor.full_name as string);
    if (!fullName) {
      return Response.json({ error: "Full name cannot be empty" }, { status: 400 });
    }

    if (body.full_name !== undefined) {
      const { error } = await admin
        .from("counselors")
        .update({ full_name: fullName })
        .eq("id", id);
      if (error) throw new Error(error.message);
    }

    const loginId = (counselor as { user_id?: string | null }).user_id ?? null;

    if (body.email?.trim()) {
      await linkCounselorLogin(admin, id, body.email.trim().toLowerCase(), fullName);
    } else if (loginId && (body.is_active !== undefined || body.full_name !== undefined)) {
      const blocked = await assertStaffUserEditable(admin, loginId);
      if (blocked) {
        return Response.json({ error: blocked.error }, { status: blocked.status });
      }
      await upsertStaffProfile(admin, loginId, {
        role: "counselor",
        full_name: fullName,
        ...(body.is_active !== undefined ? { is_active: body.is_active } : {}),
      });
    }

    if (body.office_ids !== undefined) {
      const officeIds = body.office_ids.map((oid) => oid.trim()).filter(Boolean);
      if (officeIds.length === 0) {
        return Response.json({ error: "At least one office is required" }, { status: 400 });
      }
      await replaceCounselorOfficeAssignments(admin, id, officeIds);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("admin");
    const id = request.nextUrl.searchParams.get("id")?.trim();

    if (!id) {
      return Response.json({ error: "id is required" }, { status: 400 });
    }

    let counselorsQuery = await admin
      .from("counselors")
      .select("id, user_id")
      .eq("id", id)
      .maybeSingle();
    if (counselorsQuery.error?.message.includes("user_id")) {
      counselorsQuery = await admin.from("counselors").select("id").eq("id", id).maybeSingle();
    }

    const counselor = counselorsQuery.data;
    if (!counselor) {
      return Response.json({ error: "Counselor not found" }, { status: 404 });
    }

    const loginId = (counselor as { user_id?: string | null }).user_id ?? null;
    const clientCount = await countClientsForCounselor(admin, id, loginId);

    if (clientCount > 0) {
      return Response.json(
        {
          error: `This counselor still has ${clientCount} assigned client(s). Reassign those clients first.`,
        },
        { status: 409 }
      );
    }

    await admin.from("counselor_office_assignments").delete().eq("counselor_id", id);
    const { error: deleteErr } = await admin.from("counselors").delete().eq("id", id);
    if (deleteErr) throw new Error(deleteErr.message);

    if (loginId) {
      const blocked = await assertStaffUserEditable(admin, loginId);
      if (!blocked) {
        await upsertStaffProfile(admin, loginId, { role: "counselor", is_active: false });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
