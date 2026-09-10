import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getSupabaseUrl } from "@wayfinder/supabase";

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

export async function createStaffAuthUserSilently(
  admin: AdminClient,
  email: string,
  metadata?: { full_name?: string }
): Promise<string> {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    email_confirm: true,
    user_metadata: metadata,
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Could not create user";
    if (/already|registered|exists/i.test(msg)) {
      throw new Error("Email already registered");
    }
    throw new Error(msg);
  }
  return created.user.id;
}

export async function provisionStaffAuthUser(
  admin: AdminClient,
  email: string,
  metadata: { full_name?: string } | undefined,
  options: { sendInvite: boolean }
): Promise<string> {
  if (options.sendInvite) {
    return inviteStaffAuthUser(admin, email, metadata);
  }
  return createStaffAuthUserSilently(admin, email, metadata);
}

/** Sends a Wayfinder Pro magic-link email through Supabase (for silent or resend flows). */
export async function sendStaffLoginEmail(admin: AdminClient, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Email is required");
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }

  const res = await fetch(`${getSupabaseUrl()}/auth/v1/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email: normalized,
      options: {
        emailRedirectTo: staffInviteRedirectUrl(),
        shouldCreateUser: false,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || "Could not send login email");
  }

  // Ensure the auth user exists (silent provisioning should have created them already).
  const userId = await findAuthUserIdByEmail(admin, normalized);
  if (!userId) {
    throw new Error("No Wayfinder login exists for that email yet");
  }
}

export async function upsertStaffProfile(
  admin: AdminClient,
  userId: string,
  fields: {
    role: string;
    full_name?: string;
    is_active?: boolean;
    staff_removed_at?: string | null;
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
  if (fields.staff_removed_at !== undefined) {
    row.staff_removed_at = fields.staff_removed_at;
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

export async function linkCounselorLogin(
  admin: AdminClient,
  counselorId: string,
  email: string,
  fullName: string,
  options: { sendInvite: boolean }
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  let userId = await findAuthUserIdByEmail(admin, normalizedEmail);

  if (!userId) {
    userId = await provisionStaffAuthUser(
      admin,
      normalizedEmail,
      { full_name: fullName },
      { sendInvite: options.sendInvite }
    );
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
      throw new Error(
        `This account already has the “${role}” role and cannot be converted to counselor.`
      );
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

export type CounselorLoginActivationResult = {
  counselorId: string;
  fullName: string;
  email: string | null;
  outcome: "activated" | "reactivated" | "skipped";
  reason?: string;
};

export async function activateCounselorLoginFromContactEmail(
  admin: AdminClient,
  counselor: {
    id: string;
    full_name: string;
    contact_email: string | null;
    user_id: string | null;
  },
  options: { sendInvite: boolean }
): Promise<CounselorLoginActivationResult> {
  const base = {
    counselorId: counselor.id,
    fullName: counselor.full_name,
    email: counselor.contact_email?.trim().toLowerCase() ?? null,
  };

  if (counselor.user_id) {
    const blocked = await assertStaffUserEditable(admin, counselor.user_id);
    if (blocked) {
      return { ...base, outcome: "skipped", reason: blocked.error };
    }
    await upsertStaffProfile(admin, counselor.user_id, {
      role: "counselor",
      full_name: counselor.full_name,
      is_active: true,
    });
    return { ...base, outcome: "reactivated" };
  }

  const email = counselor.contact_email?.trim().toLowerCase() ?? "";
  if (!email.includes("@")) {
    return { ...base, outcome: "skipped", reason: "No referral email on file" };
  }

  await linkCounselorLogin(admin, counselor.id, email, counselor.full_name, options);
  return { ...base, email, outcome: "activated" };
}

export async function listCounselorIdsForOffice(
  admin: AdminClient,
  officeId: string
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: assignments } = await admin
    .from("counselor_office_assignments")
    .select("counselor_id")
    .eq("office_id", officeId);
  for (const row of assignments ?? []) {
    if (row.counselor_id) ids.add(row.counselor_id as string);
  }

  const { data: legacy } = await admin.from("counselors").select("id").eq("office_id", officeId);
  for (const row of legacy ?? []) {
    if (row.id) ids.add(row.id as string);
  }

  return [...ids];
}

export async function bulkActivateCounselorLoginsForOffice(
  admin: AdminClient,
  officeId: string,
  options: { sendInvite: boolean }
): Promise<{
  results: CounselorLoginActivationResult[];
  activated: number;
  reactivated: number;
  skipped: number;
}> {
  const counselorIds = await listCounselorIdsForOffice(admin, officeId);
  if (counselorIds.length === 0) {
    return { results: [], activated: 0, reactivated: 0, skipped: 0 };
  }

  const { data: counselors, error } = await admin
    .from("counselors")
    .select("id, full_name, contact_email, user_id")
    .in("id", counselorIds);

  if (error) {
    throw new Error(error.message);
  }

  const results: CounselorLoginActivationResult[] = [];
  let activated = 0;
  let reactivated = 0;
  let skipped = 0;

  for (const row of counselors ?? []) {
    const result = await activateCounselorLoginFromContactEmail(
      admin,
      {
        id: row.id as string,
        full_name: row.full_name as string,
        contact_email: (row.contact_email as string | null) ?? null,
        user_id: (row.user_id as string | null) ?? null,
      },
      options
    );
    results.push(result);
    if (result.outcome === "activated") activated++;
    else if (result.outcome === "reactivated") reactivated++;
    else skipped++;
  }

  return { results, activated, reactivated, skipped };
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

export type CaseloadReleaseResult = {
  totalClients: number;
  reassignedToSupervisor: number;
  leftUnassigned: number;
  alreadyReassigned: number;
};

async function isActiveSupervisor(admin: AdminClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", userId)
    .maybeSingle();
  return data?.role === "supervisor" && data.is_active !== false;
}

/** Assign (or reassign) a client caseload row and message routing to one staff user. */
export async function assignClientCaseload(
  admin: AdminClient,
  clientId: string,
  esUserId: string
): Promise<void> {
  const { error: clearErr } = await admin
    .from("es_client_assignments")
    .delete()
    .eq("client_id", clientId);
  if (clearErr) throw new Error(clearErr.message);

  const { error: assignErr } = await admin.from("es_client_assignments").insert({
    es_user_id: esUserId,
    client_id: clientId,
  });
  if (assignErr) throw new Error(assignErr.message);

  const { error: threadErr } = await admin
    .from("client_message_threads")
    .update({ current_es_user_id: esUserId })
    .eq("client_id", clientId);
  if (threadErr) throw new Error(threadErr.message);
}

async function resolveSupervisorForClient(
  admin: AdminClient,
  opts: {
    departingEsUserId: string;
    clientId: string;
    linkedSupervisorIds: string[];
    clientSupervisorUserId?: string | null;
  }
): Promise<string | null> {
  const clientSupervisor = (opts.clientSupervisorUserId ?? "").trim();
  if (clientSupervisor && (await isActiveSupervisor(admin, clientSupervisor))) {
    return clientSupervisor;
  }

  for (const supervisorId of opts.linkedSupervisorIds) {
    if (await isActiveSupervisor(admin, supervisorId)) {
      return supervisorId;
    }
  }

  return null;
}

/**
 * Release an ES/supervisor caseload. When reassignToSupervisor is true (default),
 * each client moves to their supervisor unless they already have another assignee.
 */
export async function releaseStaffCaseloadAssignments(
  admin: AdminClient,
  userId: string,
  options: { reassignToSupervisor?: boolean } = {}
): Promise<CaseloadReleaseResult> {
  const reassignToSupervisor = options.reassignToSupervisor !== false;

  const { data: links, error: listErr } = await admin
    .from("es_client_assignments")
    .select("client_id")
    .eq("es_user_id", userId);
  if (listErr) throw new Error(listErr.message);

  const clientIds = [...new Set((links ?? []).map((row) => row.client_id as string).filter(Boolean))];

  const { data: supervisorLinks } = await admin
    .from("supervisor_es_assignments")
    .select("supervisor_user_id")
    .eq("es_user_id", userId);
  const linkedSupervisorIds = [
    ...new Set((supervisorLinks ?? []).map((row) => row.supervisor_user_id as string).filter(Boolean)),
  ];

  const result: CaseloadReleaseResult = {
    totalClients: clientIds.length,
    reassignedToSupervisor: 0,
    leftUnassigned: 0,
    alreadyReassigned: 0,
  };

  if (clientIds.length === 0) {
    return result;
  }

  const { data: clientRows } = await admin
    .from("clients")
    .select("id, supervisor_user_id")
    .in("id", clientIds);

  const supervisorByClient = new Map(
    (clientRows ?? []).map((row) => [row.id as string, (row.supervisor_user_id as string | null) ?? null])
  );

  for (const clientId of clientIds) {
    const { data: currentAssignment } = await admin
      .from("es_client_assignments")
      .select("es_user_id")
      .eq("client_id", clientId)
      .maybeSingle();

    const currentAssignee = (currentAssignment?.es_user_id as string | undefined) ?? null;
    if (currentAssignee && currentAssignee !== userId) {
      result.alreadyReassigned += 1;
      continue;
    }

    if (reassignToSupervisor) {
      const supervisorId = await resolveSupervisorForClient(admin, {
        departingEsUserId: userId,
        clientId,
        linkedSupervisorIds,
        clientSupervisorUserId: supervisorByClient.get(clientId),
      });

      if (supervisorId) {
        await assignClientCaseload(admin, clientId, supervisorId);
        result.reassignedToSupervisor += 1;
        continue;
      }
    }

    const { error: clearErr } = await admin
      .from("es_client_assignments")
      .delete()
      .eq("client_id", clientId)
      .eq("es_user_id", userId);
    if (clearErr) throw new Error(clearErr.message);

    const { error: threadErr } = await admin
      .from("client_message_threads")
      .update({ current_es_user_id: null })
      .eq("client_id", clientId)
      .eq("current_es_user_id", userId);
    if (threadErr) throw new Error(threadErr.message);

    result.leftUnassigned += 1;
  }

  return result;
}

/** @deprecated Use releaseStaffCaseloadAssignments. */
export async function clearStaffCaseloadAssignments(
  admin: AdminClient,
  userId: string
): Promise<number> {
  const result = await releaseStaffCaseloadAssignments(admin, userId, {
    reassignToSupervisor: false,
  });
  return result.totalClients;
}

/**
 * Reassign unassigned active clients to their supervisor (repair after ES removal).
 * Skips clients that already have a caseload assignee.
 */
export async function repairOrphanedClientsToSupervisors(
  admin: AdminClient,
  options: { esUserId?: string | null } = {}
): Promise<CaseloadReleaseResult> {
  const esUserId = (options.esUserId ?? "").trim() || null;

  const { data: assignedRows, error: assignedErr } = await admin
    .from("es_client_assignments")
    .select("client_id");
  if (assignedErr) throw new Error(assignedErr.message);

  const assignedClientIds = new Set(
    (assignedRows ?? []).map((row) => row.client_id as string).filter(Boolean)
  );

  let candidateClientIds: string[] = [];

  if (esUserId) {
    const { data: timeRows, error: timeErr } = await admin
      .from("es_time_entries")
      .select("client_id")
      .eq("es_user_id", esUserId)
      .not("client_id", "is", null);
    if (timeErr) throw new Error(timeErr.message);

    candidateClientIds = [
      ...new Set((timeRows ?? []).map((row) => row.client_id as string).filter(Boolean)),
    ].filter((id) => !assignedClientIds.has(id));
  } else {
    let clientQuery = admin
      .from("clients")
      .select("id, supervisor_user_id")
      .eq("intake_status", "active")
      .not("supervisor_user_id", "is", null);

    const { data: clientRows, error: clientErr } = await clientQuery;
    if (clientErr?.message?.includes("supervisor_user_id")) {
      return {
        totalClients: 0,
        reassignedToSupervisor: 0,
        leftUnassigned: 0,
        alreadyReassigned: 0,
      };
    }
    if (clientErr) throw new Error(clientErr.message);

    candidateClientIds = (clientRows ?? [])
      .map((row) => row.id as string)
      .filter((id) => !assignedClientIds.has(id));
  }

  const result: CaseloadReleaseResult = {
    totalClients: candidateClientIds.length,
    reassignedToSupervisor: 0,
    leftUnassigned: 0,
    alreadyReassigned: 0,
  };

  if (candidateClientIds.length === 0) {
    return result;
  }

  const { data: clients } = await admin
    .from("clients")
    .select("id, supervisor_user_id")
    .in("id", candidateClientIds);

  for (const client of clients ?? []) {
    const clientId = client.id as string;

    if (assignedClientIds.has(clientId)) {
      result.alreadyReassigned += 1;
      continue;
    }

    const supervisorId = (client.supervisor_user_id as string | null) ?? null;
    if (!supervisorId || !(await isActiveSupervisor(admin, supervisorId))) {
      result.leftUnassigned += 1;
      continue;
    }

    await assignClientCaseload(admin, clientId, supervisorId);
    assignedClientIds.add(clientId);
    result.reassignedToSupervisor += 1;
  }

  return result;
}

/** Soft-remove a field specialist from day-to-day use (login kept, inactive). */
export async function softRemoveEmploymentSpecialist(
  admin: AdminClient,
  userId: string
): Promise<CaseloadReleaseResult> {
  const release = await releaseStaffCaseloadAssignments(admin, userId, {
    reassignToSupervisor: true,
  });
  await admin.from("supervisor_es_assignments").delete().eq("es_user_id", userId);
  await replaceStaffOfficeAssignments(admin, userId, []);

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const role =
    profile?.role === "transition_specialist" ? "transition_specialist" : "es";

  await upsertStaffProfile(admin, userId, {
    role,
    is_active: false,
    staff_removed_at: new Date().toISOString(),
  });
  return release;
}

/** Permanently remove Auth user + profile (cascades assignment FKs). */
export async function hardDeleteStaffAuthUser(admin: AdminClient, userId: string): Promise<void> {
  await releaseStaffCaseloadAssignments(admin, userId, { reassignToSupervisor: true });
  await admin.from("supervisor_es_assignments").delete().eq("es_user_id", userId);
  await admin.from("supervisor_es_assignments").delete().eq("supervisor_user_id", userId);
  await replaceStaffOfficeAssignments(admin, userId, []);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
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
