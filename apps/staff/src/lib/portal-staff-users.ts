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
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) return null;
  return (
    data.users?.find((u) => (u.email ?? "").trim().toLowerCase() === normalized)?.id ?? null
  );
}

export function staffInviteRedirectUrl(): string {
  const raw = process.env.NEXT_PUBLIC_STAFF_APP_URL ?? "http://localhost:3000";
  return `${raw.replace(/\/$/, "")}/auth/callback`;
}

export async function inviteStaffAuthUser(
  admin: AdminClient,
  email: string,
  metadata?: { full_name?: string }
): Promise<string> {
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: staffInviteRedirectUrl(),
    data: metadata,
  });
  if (inviteErr || !invited.user) {
    throw new Error(inviteErr?.message ?? "Could not invite user");
  }
  return invited.user.id;
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
  const row: Record<string, unknown> = {
    id: userId,
    role: fields.role,
    is_active: fields.is_active ?? true,
  };
  if (fields.full_name !== undefined) {
    row.full_name = fields.full_name;
  }

  const { error: upsertErr } = await admin.from("profiles").upsert(row, { onConflict: "id" });

  if (upsertErr) {
    const patch = { ...row };
    delete patch.id;
    const { data: updated, error: updateErr } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", userId)
      .select("id")
      .maybeSingle();

    if (updateErr) {
      throw new Error(updateErr.message);
    }

    if (!updated) {
      const { error: insertErr } = await admin.from("profiles").insert(row);
      if (insertErr) {
        throw new Error(insertErr.message);
      }
    }
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
