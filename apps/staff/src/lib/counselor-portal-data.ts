import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { buildClientActivityFkIds } from "@wayfinder/supabase";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";

export type CounselorPortalClient = {
  /** Route + display key (clients.id or legacy profile_id). */
  linkId: string;
  /** Preferred FK for timeline tables (legacy may use profile/login id). */
  fkClientId: string;
  /** All ids timeline rows may reference. */
  activityFkIds: string[];
  user_id: string | null;
  profile_id: string | null;
  current_stage_id: string | null;
  counselor_id: string | null;
  contact_email: string | null;
};

function normalizeClient(row: {
  id: string | null;
  user_id: string | null;
  profile_id: string | null;
  current_stage_id: string | null;
  counselor_id: string | null;
  contact_email?: string | null;
}): CounselorPortalClient | null {
  const linkId = row.id ?? row.profile_id;
  const fkClientId = row.user_id ?? row.profile_id ?? row.id;
  if (!linkId || !fkClientId) {
    return null;
  }
  return {
    linkId,
    fkClientId,
    activityFkIds: buildClientActivityFkIds(row),
    user_id: row.user_id,
    profile_id: row.profile_id,
    current_stage_id: row.current_stage_id,
    counselor_id: row.counselor_id,
    contact_email: row.contact_email ?? null,
  };
}

export function getCounselorPortalAdmin() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

const CLIENT_SELECT =
  "id, user_id, profile_id, current_stage_id, counselor_id, contact_email";

/**
 * Legacy DBs: clients.counselor_id → profiles.id (counselor login uuid).
 * Wayfinder: clients.counselor_id → counselors.id. Match either when both are known.
 */
async function queryAssignedClientRows(
  admin: ReturnType<typeof createServiceRoleClient>,
  counselorRowId: string,
  authUserId?: string
) {
  const base = admin.from("clients").select(CLIENT_SELECT);
  const withLogin =
    authUserId && authUserId !== counselorRowId
      ? base.or(`counselor_id.eq.${authUserId},counselor_id.eq.${counselorRowId}`)
      : base.eq("counselor_id", authUserId ?? counselorRowId);

  const { data, error } = await withLogin;
  if (!error) {
    return { data, error: null as null };
  }
  if (!error.message.includes("contact_email")) {
    return { data: null, error };
  }
  const retryBase = admin.from("clients").select(
    "id, user_id, profile_id, current_stage_id, counselor_id"
  );
  const retryQuery =
    authUserId && authUserId !== counselorRowId
      ? retryBase.or(`counselor_id.eq.${authUserId},counselor_id.eq.${counselorRowId}`)
      : retryBase.eq("counselor_id", authUserId ?? counselorRowId);
  return retryQuery;
}

/** Loads assigned clients for a counselor row (server-only; bypasses RLS). */
export async function fetchCounselorAssignedClients(
  counselorId: string,
  authUserId?: string
): Promise<{
  clients: CounselorPortalClient[];
  error: string | null;
  devHint: string | null;
}> {
  const admin = getCounselorPortalAdmin();
  if (!admin) {
    console.error("[counselor portal] Missing SUPABASE_SERVICE_ROLE_KEY on staff app");
    return {
      clients: [],
      error: USER_FACING_SYSTEM_ERROR,
      devHint: null,
    };
  }

  const { data, error } = await queryAssignedClientRows(admin, counselorId, authUserId);

  if (error) {
    console.error("[counselor portal] load clients failed:", error.message);
    return { clients: [], error: USER_FACING_SYSTEM_ERROR, devHint: null };
  }

  const rawRows = data ?? [];
  const clients = rawRows
    .map((row) => normalizeClient(row))
    .filter(Boolean) as CounselorPortalClient[];

  let devHint: string | null = null;
  if (process.env.NODE_ENV === "development" && clients.length === 0) {
    devHint = await buildCounselorClientDevHint(admin, counselorId, authUserId, rawRows.length);
  }

  return { clients, error: null, devHint };
}

async function buildCounselorClientDevHint(
  admin: ReturnType<typeof createServiceRoleClient>,
  counselorId: string,
  authUserId: string | undefined,
  matchedRawRows: number
): Promise<string> {
  const [{ count: totalClients }, { count: byCounselorRow }, { count: byLogin }, { data: demo }] =
    await Promise.all([
    admin.from("clients").select("id", { count: "exact", head: true }),
    admin
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("counselor_id", counselorId),
    authUserId
      ? admin
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("counselor_id", authUserId)
      : Promise.resolve({ count: 0 }),
    admin
      .from("clients")
      .select("id, profile_id, counselor_id, contact_email")
      .eq("contact_email", "demo.client@example.com")
      .maybeSingle(),
  ]);

  const parts = [
    `total clients in this project: ${totalClients ?? 0}`,
    authUserId
      ? `rows with counselor_id=profile/login ${authUserId} (legacy FK): ${byLogin ?? 0}`
      : null,
    `rows with counselor_id=counselors row ${counselorId}: ${byCounselorRow ?? 0}`,
    matchedRawRows > 0 ? `${matchedRawRows} row(s) matched but missing id and profile_id` : null,
    demo
      ? `demo.client counselor_id=${demo.counselor_id ?? "null"}`
      : "no demo.client@example.com row",
  ].filter(Boolean);

  return parts.join(" · ");
}

/** One assigned client for the activity page (server-only). */
export async function fetchCounselorClientForActivity(
  counselorId: string,
  linkId: string,
  authUserId?: string
): Promise<{
  client: CounselorPortalClient | null;
  error: string | null;
}> {
  const { clients, error } = await fetchCounselorAssignedClients(counselorId, authUserId);
  if (error) {
    return { client: null, error };
  }
  const client = clients.find((c) => c.linkId === linkId || c.fkClientId === linkId) ?? null;
  return { client, error: null };
}
