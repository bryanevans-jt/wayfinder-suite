import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUser } from "./notify-user";
import {
  counselorDuplicatePairKey,
  counselorNameMatchKind,
  normalizeCounselorName,
} from "./counselor-name-match";

export * from "./counselor-name-match";

const DUPLICATE_KIND = "counselor_possible_duplicate";
const MERGE_LINK = "/dashboard/super-admin?offices=counselors";

type CounselorRow = {
  id: string;
  full_name: string;
  contact_email: string | null;
  user_id: string | null;
  office_id: string | null;
};

async function loadCounselorDirectory(admin: SupabaseClient): Promise<CounselorRow[]> {
  let query = await admin
    .from("counselors")
    .select("id, full_name, contact_email, user_id, office_id");
  if (query.error?.message.includes("contact_email")) {
    query = await admin.from("counselors").select("id, full_name, user_id, office_id");
  }
  if (query.error) {
    console.error("loadCounselorDirectory failed:", query.error.message);
    return [];
  }
  return (query.data ?? []).map((row) => ({
    id: row.id as string,
    full_name: row.full_name as string,
    contact_email: ((row as { contact_email?: string | null }).contact_email ?? null) as
      | string
      | null,
    user_id: ((row as { user_id?: string | null }).user_id ?? null) as string | null,
    office_id: (row.office_id as string | null) ?? null,
  }));
}

export async function findExactNormalizedCounselor(
  admin: SupabaseClient,
  fullName: string
): Promise<CounselorRow[]> {
  const target = normalizeCounselorName(fullName);
  if (!target) return [];
  return (await loadCounselorDirectory(admin)).filter(
    (row) => counselorNameMatchKind(row.full_name, fullName) === "exact"
  );
}

export async function findNearCounselorMatches(
  admin: SupabaseClient,
  opts: { fullName: string; excludeId?: string }
): Promise<Array<CounselorRow & { kind: "exact" | "near" }>> {
  const rows = await loadCounselorDirectory(admin);
  return rows
    .filter((row) => row.id !== opts.excludeId)
    .map((row) => {
      const kind = counselorNameMatchKind(row.full_name, opts.fullName);
      return kind ? { ...row, kind } : null;
    })
    .filter((row): row is CounselorRow & { kind: "exact" | "near" } => Boolean(row));
}

async function alreadyNotified(
  admin: SupabaseClient,
  pairKey: string
): Promise<boolean> {
  const { data } = await admin
    .from("in_app_notifications")
    .select("id")
    .eq("kind", DUPLICATE_KIND)
    .contains("metadata", { pairKey })
    .is("read_at", null)
    .limit(1);
  return Boolean(data?.length);
}

export async function notifySuperAdminsOfCounselorNearMatch(
  admin: SupabaseClient,
  opts: {
    newCounselorId: string;
    newCounselorName: string;
    matches: Array<{ id: string; full_name: string; kind: "exact" | "near" }>;
  }
): Promise<void> {
  if (opts.matches.length === 0) return;

  const { data: supers } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .eq("is_active", true);

  if (!supers?.length) return;

  for (const match of opts.matches) {
    const pairKey = counselorDuplicatePairKey(opts.newCounselorId, match.id);
    if (await alreadyNotified(admin, pairKey)) continue;

    const keep = match.id;
    const source = opts.newCounselorId;
    const link_path = `${MERGE_LINK}&keep=${encodeURIComponent(keep)}&source=${encodeURIComponent(source)}`;
    const reason = match.kind === "exact" ? "same name" : "similar spelling";
    const title = `Possible duplicate counselor: ${opts.newCounselorName}`;
    const body = `“${opts.newCounselorName}” looks like “${match.full_name}” (${reason}). Review and combine them in Super Admin → Offices → Counselors if they are the same person.`;

    for (const profile of supers) {
      await notifyUser(admin, {
        userId: profile.id as string,
        app: "staff",
        kind: DUPLICATE_KIND,
        title,
        body,
        link_path,
        metadata: {
          pairKey,
          keeperId: keep,
          sourceId: source,
          matchKind: match.kind,
        },
      });
    }
  }
}

export async function mergeCounselors(
  admin: SupabaseClient,
  opts: { keeperId: string; sourceId: string }
): Promise<{ ok: true; movedClients: number } | { error: string }> {
  const keeperId = opts.keeperId.trim();
  const sourceId = opts.sourceId.trim();
  if (!keeperId || !sourceId) return { error: "Keep and combine counselors are required" };
  if (keeperId === sourceId) return { error: "Pick two different counselors" };

  const directory = await loadCounselorDirectory(admin);
  const keeper = directory.find((row) => row.id === keeperId);
  const source = directory.find((row) => row.id === sourceId);
  if (!keeper || !source) return { error: "Counselor not found" };

  const sourceIds = [sourceId, source.user_id].filter(Boolean) as string[];
  let movedClients = 0;
  for (const id of [...new Set(sourceIds)]) {
    const { data, error } = await admin
      .from("clients")
      .update({ counselor_id: keeperId })
      .eq("counselor_id", id)
      .select("id");
    if (error) return { error: error.message };
    movedClients += data?.length ?? 0;
  }

  const [{ data: sourceOffices }, { data: keeperOffices }] = await Promise.all([
    admin.from("counselor_office_assignments").select("office_id").eq("counselor_id", sourceId),
    admin.from("counselor_office_assignments").select("office_id").eq("counselor_id", keeperId),
  ]);
  const keeperOfficeSet = new Set((keeperOffices ?? []).map((row) => row.office_id as string));
  const officesToAdd = (sourceOffices ?? [])
    .map((row) => row.office_id as string)
    .filter((officeId) => officeId && !keeperOfficeSet.has(officeId));
  if (officesToAdd.length) {
    const { error } = await admin.from("counselor_office_assignments").insert(
      officesToAdd.map((office_id) => ({ counselor_id: keeperId, office_id }))
    );
    if (error) return { error: error.message };
  }
  await admin.from("counselor_office_assignments").delete().eq("counselor_id", sourceId);

  const keeperPatch: Record<string, unknown> = {};
  if (!keeper.contact_email && source.contact_email) {
    keeperPatch.contact_email = source.contact_email;
  }
  if (!keeper.office_id && source.office_id) {
    keeperPatch.office_id = source.office_id;
  }
  if (!keeper.user_id && source.user_id) {
    keeperPatch.user_id = source.user_id;
  }

  if (keeper.user_id && source.user_id && keeper.user_id !== source.user_id) {
    await admin.from("profiles").update({ is_active: false }).eq("id", source.user_id);
  }

  if (keeperPatch.user_id || keeperPatch.contact_email) {
    const clear: Record<string, unknown> = {};
    if (keeperPatch.user_id) clear.user_id = null;
    if (keeperPatch.contact_email) clear.contact_email = null;
    const { error: clearErr } = await admin.from("counselors").update(clear).eq("id", sourceId);
    if (clearErr && !/Could not find the '|does not exist/i.test(clearErr.message)) {
      return { error: clearErr.message };
    }
  }

  if (Object.keys(keeperPatch).length) {
    const { error } = await admin.from("counselors").update(keeperPatch).eq("id", keeperId);
    if (error) return { error: error.message };
  }

  const { error: deleteErr } = await admin.from("counselors").delete().eq("id", sourceId);
  if (deleteErr) return { error: deleteErr.message };

  const pairKey = counselorDuplicatePairKey(keeperId, sourceId);
  await admin
    .from("in_app_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("kind", DUPLICATE_KIND)
    .contains("metadata", { pairKey })
    .is("read_at", null);

  return { ok: true, movedClients };
}
