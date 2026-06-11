import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

export async function assertStaffUserEditable(
  admin: AdminClient,
  userId: string
): Promise<{ error: string; status: number } | null> {
  const { data: protectedRow } = await admin
    .from("system_protected_profiles")
    .select("profile_id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (protectedRow) {
    return { error: "Protected account cannot be modified", status: 403 };
  }
  return null;
}

export async function findAuthUserIdByEmail(
  admin: AdminClient,
  email: string
): Promise<string | null> {
  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 1000 });
  return listed.users?.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
}

export async function upsertStaffProfile(
  admin: AdminClient,
  userId: string,
  fields: {
    role: string;
    full_name?: string;
    is_active?: boolean;
  }
): Promise<void> {
  const patch: Record<string, unknown> = { role: fields.role };
  if (fields.full_name !== undefined) patch.full_name = fields.full_name;
  if (fields.is_active !== undefined) patch.is_active = fields.is_active;

  const { error: updateErr } = await admin.from("profiles").update(patch).eq("id", userId);

  if (updateErr) {
    const { error: insertErr } = await admin.from("profiles").insert({
      id: userId,
      role: fields.role,
      full_name: fields.full_name ?? null,
      is_active: fields.is_active ?? true,
    });
    if (insertErr) throw new Error(insertErr.message);
  }

  if (fields.full_name !== undefined) {
    await admin.auth.admin.updateUserById(userId, {
      user_metadata: { full_name: fields.full_name },
    });
  }
}

export async function replaceStaffOfficeAssignments(
  admin: AdminClient,
  userId: string,
  officeIds: string[]
): Promise<void> {
  const { error: clearErr } = await admin
    .from("staff_office_assignments")
    .delete()
    .eq("user_id", userId);
  if (clearErr) throw new Error(clearErr.message);

  const unique = [...new Set(officeIds.filter(Boolean))];
  if (unique.length === 0) return;

  const { error: insertErr } = await admin.from("staff_office_assignments").insert(
    unique.map((office_id) => ({
      user_id: userId,
      office_id,
    }))
  );
  if (insertErr) throw new Error(insertErr.message);
}

export async function replaceCounselorOfficeAssignments(
  admin: AdminClient,
  counselorId: string,
  officeIds: string[],
  primaryOfficeId?: string
): Promise<void> {
  const unique = [...new Set(officeIds.filter(Boolean))];
  const primary = primaryOfficeId ?? unique[0];

  if (primary) {
    const { error: officeErr } = await admin
      .from("counselors")
      .update({ office_id: primary })
      .eq("id", counselorId);
    if (officeErr && !officeErr.message.includes("Could not find")) {
      throw new Error(officeErr.message);
    }
  }

  const { error: clearErr } = await admin
    .from("counselor_office_assignments")
    .delete()
    .eq("counselor_id", counselorId);
  if (clearErr) throw new Error(clearErr.message);

  if (unique.length === 0) return;

  const { error: insertErr } = await admin.from("counselor_office_assignments").insert(
    unique.map((office_id) => ({
      counselor_id: counselorId,
      office_id,
    }))
  );
  if (insertErr) throw new Error(insertErr.message);
}

export async function countClientsForCounselor(
  admin: AdminClient,
  counselorId: string,
  loginUserId?: string | null
): Promise<number> {
  if (loginUserId && loginUserId !== counselorId) {
    const { count, error } = await admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .or(`counselor_id.eq.${counselorId},counselor_id.eq.${loginUserId}`);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  const { count, error } = await admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("counselor_id", counselorId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
