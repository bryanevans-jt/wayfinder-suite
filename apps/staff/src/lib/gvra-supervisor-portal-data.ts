import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { listCounselorIdsForOffice } from "@/lib/portal-staff-users";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

export type GvraSupervisorCounselorSummary = {
  id: string;
  full_name: string;
  contact_email: string | null;
  has_login: boolean;
  office_ids: string[];
  client_count: number;
};

export async function loadGvraSupervisorOfficeIds(
  admin: AdminClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("staff_office_assignments")
    .select("office_id")
    .eq("user_id", userId);
  if (error) {
    throw new Error(error.message);
  }
  return [...new Set((data ?? []).map((row) => row.office_id as string).filter(Boolean))];
}

export async function loadCounselorOfficeIds(
  admin: AdminClient,
  counselorId: string
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: counselor } = await admin
    .from("counselors")
    .select("office_id")
    .eq("id", counselorId)
    .maybeSingle();
  if (counselor?.office_id) {
    ids.add(counselor.office_id as string);
  }

  const { data: links } = await admin
    .from("counselor_office_assignments")
    .select("office_id")
    .eq("counselor_id", counselorId);
  for (const row of links ?? []) {
    if (row.office_id) ids.add(row.office_id as string);
  }

  return [...ids];
}

export async function gvraSupervisorCanAccessCounselor(
  admin: AdminClient,
  supervisorUserId: string,
  counselorId: string
): Promise<boolean> {
  const [supervisorOffices, counselorOffices] = await Promise.all([
    loadGvraSupervisorOfficeIds(admin, supervisorUserId),
    loadCounselorOfficeIds(admin, counselorId),
  ]);
  if (supervisorOffices.length === 0 || counselorOffices.length === 0) {
    return false;
  }
  const allowed = new Set(supervisorOffices);
  return counselorOffices.some((officeId) => allowed.has(officeId));
}

async function countClientsForCounselor(
  admin: AdminClient,
  counselorId: string,
  loginUserId: string | null
): Promise<number> {
  const useLoginOr = Boolean(loginUserId && loginUserId !== counselorId);
  const orFilter = `counselor_id.eq.${loginUserId},counselor_id.eq.${counselorId}`;
  const singleId = loginUserId ?? counselorId;

  const query = admin.from("clients").select("id", { count: "exact", head: true });
  const { count, error } = await (useLoginOr
    ? query.or(orFilter)
    : query.eq("counselor_id", singleId));
  if (error) {
    return 0;
  }
  return count ?? 0;
}

export async function loadGvraSupervisorCounselors(
  admin: AdminClient,
  supervisorUserId: string
): Promise<GvraSupervisorCounselorSummary[]> {
  const officeIds = await loadGvraSupervisorOfficeIds(admin, supervisorUserId);
  if (officeIds.length === 0) {
    return [];
  }

  const counselorIds = new Set<string>();
  for (const officeId of officeIds) {
    for (const id of await listCounselorIdsForOffice(admin, officeId)) {
      counselorIds.add(id);
    }
  }

  if (counselorIds.size === 0) {
    return [];
  }

  const { data: counselors, error } = await admin
    .from("counselors")
    .select("id, full_name, contact_email, user_id, office_id")
    .in("id", [...counselorIds])
    .order("full_name");

  if (error) {
    throw new Error(error.message);
  }

  const { data: officeLinks } = await admin
    .from("counselor_office_assignments")
    .select("counselor_id, office_id")
    .in("counselor_id", [...counselorIds]);

  const officeIdsByCounselor = new Map<string, Set<string>>();
  for (const counselor of counselors ?? []) {
    const set = new Set<string>();
    if (counselor.office_id) set.add(counselor.office_id as string);
    officeIdsByCounselor.set(counselor.id as string, set);
  }
  for (const link of officeLinks ?? []) {
    const set = officeIdsByCounselor.get(link.counselor_id as string) ?? new Set<string>();
    set.add(link.office_id as string);
    officeIdsByCounselor.set(link.counselor_id as string, set);
  }

  const allowedOffices = new Set(officeIds);
  const summaries: GvraSupervisorCounselorSummary[] = [];

  for (const counselor of counselors ?? []) {
    const id = counselor.id as string;
    const counselorOffices = [...(officeIdsByCounselor.get(id) ?? [])];
    if (!counselorOffices.some((officeId) => allowedOffices.has(officeId))) {
      continue;
    }

    const loginUserId = (counselor.user_id as string | null) ?? null;
    summaries.push({
      id,
      full_name: (counselor.full_name as string).trim() || "Counselor",
      contact_email: (counselor.contact_email as string | null) ?? null,
      has_login: Boolean(loginUserId),
      office_ids: counselorOffices.filter((officeId) => allowedOffices.has(officeId)),
      client_count: await countClientsForCounselor(admin, id, loginUserId),
    });
  }

  return summaries.sort((a, b) =>
    a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" })
  );
}
