import type { SupabaseClient } from "@supabase/supabase-js";

export const COUNSELOR_OFFICE_NOT_ACTIVE_MESSAGE =
  "Your agency office is not activated for counselor access in Wayfinder Pro yet. Ask your Joshua Tree administrator to assign you to an active office under Offices → Counselors, then request a new magic link.";

export const COUNSELOR_NO_REFERRAL_EMAIL_MESSAGE =
  "No referral email is on file for this counselor record. Ask your Joshua Tree administrator to confirm the email collected from your referrals under Offices → Counselors.";

type OfficeRow = { id: string; is_hidden?: boolean | null };

export async function listCounselorDirectoryOfficeIds(
  admin: SupabaseClient,
  counselorId: string
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: counselor } = await admin
    .from("counselors")
    .select("office_id")
    .eq("id", counselorId)
    .maybeSingle();

  const primary = (counselor?.office_id as string | null) ?? null;
  if (primary) ids.add(primary);

  const { data: assignments } = await admin
    .from("counselor_office_assignments")
    .select("office_id")
    .eq("counselor_id", counselorId);

  for (const row of assignments ?? []) {
    const officeId = row.office_id as string | null;
    if (officeId) ids.add(officeId);
  }

  return [...ids];
}

/** Offices on non-discarded clients assigned to this counselor (referral roster). */
export async function listCounselorClientOfficeIds(
  admin: SupabaseClient,
  counselorId: string
): Promise<string[]> {
  const { data: rows, error } = await admin
    .from("clients")
    .select("office_id, intake_status")
    .eq("counselor_id", counselorId)
    .limit(500);

  if (error) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    if ((row.intake_status as string | null) === "discarded") continue;
    const officeId = row.office_id as string | null;
    if (!officeId) continue;
    counts.set(officeId, (counts.get(officeId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);
}

async function loadOfficesById(
  admin: SupabaseClient,
  officeIds: string[]
): Promise<Map<string, OfficeRow>> {
  const map = new Map<string, OfficeRow>();
  if (officeIds.length === 0) return map;

  const { data, error } = await admin
    .from("offices")
    .select("id, is_hidden")
    .in("id", officeIds);

  if (error?.message.includes("is_hidden")) {
    const { data: fallback } = await admin.from("offices").select("id").in("id", officeIds);
    for (const row of fallback ?? []) {
      map.set(row.id as string, { id: row.id as string, is_hidden: false });
    }
    return map;
  }

  for (const row of data ?? []) {
    map.set(row.id as string, row as OfficeRow);
  }
  return map;
}

export function isOfficeActiveForCounselorLogin(office: Pick<OfficeRow, "is_hidden">): boolean {
  return office.is_hidden !== true;
}

export async function visibleActiveOfficeIds(
  admin: SupabaseClient,
  officeIds: string[]
): Promise<string[]> {
  const unique = [...new Set(officeIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const byId = await loadOfficesById(admin, unique);
  return unique.filter((id) => {
    const office = byId.get(id);
    return office ? isOfficeActiveForCounselorLogin(office) : false;
  });
}

/**
 * Referrals often create counselors before an office is linked in the directory.
 * When clients already sit under a visible office, attach the counselor to that office.
 */
export async function ensureCounselorOfficeFromReferralCaseload(
  admin: SupabaseClient,
  counselorId: string
): Promise<string | null> {
  const existing = await listCounselorDirectoryOfficeIds(admin, counselorId);
  const existingVisible = await visibleActiveOfficeIds(admin, existing);
  if (existingVisible.length > 0) {
    return existingVisible[0]!;
  }

  const fromClients = await listCounselorClientOfficeIds(admin, counselorId);
  const visibleFromClients = await visibleActiveOfficeIds(admin, fromClients);
  const officeId = visibleFromClients[0];
  if (!officeId) {
    return null;
  }

  const { error: primaryErr } = await admin
    .from("counselors")
    .update({ office_id: officeId })
    .eq("id", counselorId);

  if (primaryErr && !primaryErr.message.includes("Could not find")) {
    throw new Error(primaryErr.message);
  }

  const { data: existingAssignment } = await admin
    .from("counselor_office_assignments")
    .select("id")
    .eq("counselor_id", counselorId)
    .eq("office_id", officeId)
    .maybeSingle();

  if (!existingAssignment) {
    const { error: assignErr } = await admin.from("counselor_office_assignments").insert({
      counselor_id: counselorId,
      office_id: officeId,
    });
    if (assignErr && !assignErr.message.includes("duplicate")) {
      throw new Error(assignErr.message);
    }
  }

  return officeId;
}

export type CounselorPortalLoginGate = {
  allowed: boolean;
  message?: string;
  activeOfficeId?: string | null;
};

/** Gate self-serve counselor magic link: referral email on file + at least one active (non-hidden) office. */
export async function evaluateCounselorPortalLoginGate(
  admin: SupabaseClient,
  counselorId: string
): Promise<CounselorPortalLoginGate> {
  await ensureCounselorOfficeFromReferralCaseload(admin, counselorId);

  const directoryOffices = await listCounselorDirectoryOfficeIds(admin, counselorId);
  const clientOffices = await listCounselorClientOfficeIds(admin, counselorId);
  const visible = await visibleActiveOfficeIds(admin, [...directoryOffices, ...clientOffices]);

  if (visible.length === 0) {
    return { allowed: false, message: COUNSELOR_OFFICE_NOT_ACTIVE_MESSAGE };
  }

  return { allowed: true, activeOfficeId: visible[0] ?? null };
}
