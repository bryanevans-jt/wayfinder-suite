import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isOnOrAfterPreEtsFieldReleaseCutoff,
  isPreEtsAuthorizationReleasedToField,
  nextPreEtsServiceMonthFromDate,
} from "./pre-ets-release";
import {
  loadSchoolFieldRecipients,
  notifyPreEtsRosterReleased,
} from "./pre-ets-roster-released-notify";
import { notifyUser } from "./notify-user";
import { isAccountantRole, isAdminTierRole, isSuperAdminRole, normalizeRole } from "./roles";

/** Active (blocked) service months as YYYY-MM-01 strings. */
export async function loadBlockedPreEtsServiceMonths(
  admin: SupabaseClient
): Promise<Set<string>> {
  const { data, error } = await admin
    .from("pre_ets_service_month_blocks")
    .select("service_month")
    .is("unblocked_at", null);
  if (error) {
    // Table may not exist yet in older local DBs — treat as none blocked.
    if (/does not exist|relation/i.test(error.message)) return new Set();
    throw new Error(error.message);
  }
  return new Set(
    (data ?? []).map((row) => String(row.service_month).slice(0, 10))
  );
}

export async function blockPreEtsServiceMonth(
  admin: SupabaseClient,
  input: { serviceMonth: string; actorUserId: string; reason?: string | null }
): Promise<void> {
  const serviceMonth = input.serviceMonth.slice(0, 10);
  const { error } = await admin.from("pre_ets_service_month_blocks").upsert(
    {
      service_month: serviceMonth,
      blocked_at: new Date().toISOString(),
      blocked_by: input.actorUserId,
      reason: input.reason?.trim() || null,
      unblocked_at: null,
      unblocked_by: null,
    },
    { onConflict: "service_month" }
  );
  if (error) throw new Error(error.message);
}

export async function unblockPreEtsServiceMonth(
  admin: SupabaseClient,
  input: { serviceMonth: string; actorUserId: string }
): Promise<void> {
  const serviceMonth = input.serviceMonth.slice(0, 10);
  const { error } = await admin
    .from("pre_ets_service_month_blocks")
    .update({
      unblocked_at: new Date().toISOString(),
      unblocked_by: input.actorUserId,
    })
    .eq("service_month", serviceMonth)
    .is("unblocked_at", null);
  if (error) throw new Error(error.message);
}

/**
 * Mark authorization(s) released to field staff. Idempotent.
 * Does not require auth_number.
 */
export async function releasePreEtsAuthorizationsToField(
  admin: SupabaseClient,
  input: {
    authorizationIds: string[];
    actorUserId: string | null;
  }
): Promise<{ releasedIds: string[] }> {
  const ids = [...new Set(input.authorizationIds.filter(Boolean))];
  if (ids.length === 0) return { releasedIds: [] };

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("pre_ets_authorizations")
    .update({
      field_released_at: now,
      field_released_by: input.actorUserId,
    })
    .in("id", ids)
    .is("field_released_at", null)
    .select("id");

  if (error) throw new Error(error.message);
  return { releasedIds: (data ?? []).map((r) => r.id as string) };
}

/**
 * Soft-hold roster lines that should leave the active instructor list.
 * Restored automatically when the same student is upserted again (removed_at cleared).
 */
export async function softHoldPreEtsRosterEntries(
  admin: SupabaseClient,
  entryIds: string[],
  reason: string
): Promise<void> {
  if (entryIds.length === 0) return;
  const { error } = await admin
    .from("pre_ets_roster_entries")
    .update({
      removed_at: new Date().toISOString(),
      removed_reason: reason,
    })
    .in("id", entryIds)
    .is("removed_at", null);
  if (error) throw new Error(error.message);
}

/** Authorizations for a service month that have at least one active (non-removed) student. */
export async function listReleasableAuthorizationsForServiceMonth(
  admin: SupabaseClient,
  serviceMonth: string
): Promise<
  Array<{
    id: string;
    school_id: string;
    auth_number: string | null;
    field_released_at: string | null;
    school_name: string;
  }>
> {
  const month = serviceMonth.slice(0, 10);
  const { data: auths, error } = await admin
    .from("pre_ets_authorizations")
    .select(
      "id, school_id, auth_number, field_released_at, auth_type, pre_ets_schools(name)"
    )
    .eq("service_month", month)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  const out: Array<{
    id: string;
    school_id: string;
    auth_number: string | null;
    field_released_at: string | null;
    school_name: string;
  }> = [];

  for (const row of auths ?? []) {
    const { count, error: countErr } = await admin
      .from("pre_ets_roster_entries")
      .select("id", { count: "exact", head: true })
      .eq("authorization_id", row.id)
      .eq("not_approved", false)
      .is("removed_at", null);
    if (countErr) throw new Error(countErr.message);
    if (!count || count < 1) continue;

    const schoolRaw = row.pre_ets_schools as
      | { name: string }
      | { name: string }[]
      | null;
    const school = Array.isArray(schoolRaw) ? schoolRaw[0] : schoolRaw;
    out.push({
      id: row.id as string,
      school_id: row.school_id as string,
      auth_number: (row.auth_number as string | null) ?? null,
      field_released_at: (row.field_released_at as string | null) ?? null,
      school_name: school?.name ?? "School",
    });
  }

  return out;
}

export async function countWorksheetImportsForServiceMonth(
  admin: SupabaseClient,
  serviceMonth: string
): Promise<number> {
  const month = serviceMonth.slice(0, 10);
  const { count, error } = await admin
    .from("pre_ets_worksheet_imports")
    .select("id", { count: "exact", head: true })
    .eq("service_month", month)
    .eq("status", "committed");
  if (error) {
    // Fallback: treat presence of any authorization for the month as "uploaded".
    if (/does not exist|column|service_month/i.test(error.message)) {
      const { count: authCount, error: authErr } = await admin
        .from("pre_ets_authorizations")
        .select("id", { count: "exact", head: true })
        .eq("service_month", month);
      if (authErr) throw new Error(authErr.message);
      return authCount ?? 0;
    }
    throw new Error(error.message);
  }
  return count ?? 0;
}

export function authorizationNeedsFieldRelease(auth: {
  field_released_at?: string | null;
  auth_number?: string | null;
  auth_type?: string | null;
}): boolean {
  return !isPreEtsAuthorizationReleasedToField(auth);
}

async function upsertMonthReleaseRow(
  admin: SupabaseClient,
  serviceMonth: string,
  patch: Record<string, string | null>
): Promise<void> {
  const month = serviceMonth.slice(0, 10);
  const { data: existing } = await admin
    .from("pre_ets_roster_month_releases")
    .select("service_month")
    .eq("service_month", month)
    .maybeSingle();
  if (existing) {
    await admin.from("pre_ets_roster_month_releases").update(patch).eq("service_month", month);
  } else {
    await admin.from("pre_ets_roster_month_releases").insert({
      service_month: month,
      ...patch,
    });
  }
}

export async function loadMissingUploadAlertRecipients(
  admin: SupabaseClient
): Promise<string[]> {
  const { data, error } = await admin.from("profiles").select("id, role").eq("is_active", true);
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const role = normalizeRole(row.role as string);
    if (isSuperAdminRole(role) || isAccountantRole(role) || isAdminTierRole(role)) {
      ids.add(row.id as string);
    }
  }
  return [...ids];
}

export type BatchFieldReleaseResult = {
  serviceMonth: string;
  releasedIds: string[];
  schoolLabels: string[];
  /** userId → school labels newly released for them */
  recipientSchoolLabels: Map<string, string[]>;
  missingUploadAlerted: boolean;
  skippedBlocked: boolean;
  skippedAlreadyNotified: boolean;
};

/**
 * Release all eligible authorizations for a service month and collect per-instructor school lists.
 * Does not send email (caller does). Sends in-app notifications unless `skipInAppNotify`.
 */
export async function releaseServiceMonthToField(
  admin: SupabaseClient,
  input: {
    serviceMonth: string;
    actorUserId: string | null;
    /** When true, skip per-auth in-app notify (batch email/notify handles it). */
    skipPerAuthNotify?: boolean;
  }
): Promise<{
  releasedIds: string[];
  schoolLabels: string[];
  recipientSchoolLabels: Map<string, string[]>;
  skippedBlocked: boolean;
}> {
  const month = input.serviceMonth.slice(0, 10);
  const blocked = await loadBlockedPreEtsServiceMonths(admin);
  if (blocked.has(month)) {
    return {
      releasedIds: [],
      schoolLabels: [],
      recipientSchoolLabels: new Map(),
      skippedBlocked: true,
    };
  }

  const releasable = await listReleasableAuthorizationsForServiceMonth(admin, month);
  const toRelease = releasable.filter((r) => !r.field_released_at);
  const { releasedIds } = await releasePreEtsAuthorizationsToField(admin, {
    authorizationIds: toRelease.map((r) => r.id),
    actorUserId: input.actorUserId,
  });

  const releasedSet = new Set(releasedIds);
  const newlyReleased = toRelease.filter((r) => releasedSet.has(r.id));
  const schoolLabels = [...new Set(newlyReleased.map((r) => r.school_name))];
  const recipientSchoolLabels = new Map<string, string[]>();

  for (const row of newlyReleased) {
    if (!input.skipPerAuthNotify) {
      await notifyPreEtsRosterReleased(admin, {
        authorizationId: row.id,
        schoolId: row.school_id,
        schoolLabel: row.school_name,
        authNumber: row.auth_number,
        serviceMonth: month,
      });
    }
    const recipients = await loadSchoolFieldRecipients(admin, row.school_id);
    for (const userId of recipients) {
      const list = recipientSchoolLabels.get(userId) ?? [];
      if (!list.includes(row.school_name)) list.push(row.school_name);
      recipientSchoolLabels.set(userId, list);
    }
  }

  if (releasedIds.length > 0) {
    await upsertMonthReleaseRow(admin, month, {
      batch_released_at: new Date().toISOString(),
    });
  }

  return { releasedIds, schoolLabels, recipientSchoolLabels, skippedBlocked: false };
}

/** Auto-release a service month when Eastern date is on/after the 20th cutoff. */
export async function maybeAutoReleaseServiceMonthAfterUpload(
  admin: SupabaseClient,
  input: { serviceMonth: string; actorUserId: string | null }
): Promise<{ released: boolean; releasedIds: string[] }> {
  const month = input.serviceMonth.slice(0, 10);
  if (!isOnOrAfterPreEtsFieldReleaseCutoff(month)) {
    return { released: false, releasedIds: [] };
  }
  const result = await releaseServiceMonthToField(admin, {
    serviceMonth: month,
    actorUserId: input.actorUserId,
    skipPerAuthNotify: false,
  });
  return { released: result.releasedIds.length > 0, releasedIds: result.releasedIds };
}

/**
 * Cron entry for the 20th (Eastern): release next month, or alert if no worksheet uploaded.
 * Returns recipient maps for optional email delivery by the staff app.
 */
export async function runPreEtsTwentiethBatchRelease(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<BatchFieldReleaseResult> {
  const serviceMonth = nextPreEtsServiceMonthFromDate(now);
  const month = serviceMonth.slice(0, 10);

  const { data: releaseRow } = await admin
    .from("pre_ets_roster_month_releases")
    .select("batch_notify_sent_at, missing_upload_alert_sent_at")
    .eq("service_month", month)
    .maybeSingle();

  const blocked = await loadBlockedPreEtsServiceMonths(admin);
  if (blocked.has(month)) {
    return {
      serviceMonth: month,
      releasedIds: [],
      schoolLabels: [],
      recipientSchoolLabels: new Map(),
      missingUploadAlerted: false,
      skippedBlocked: true,
      skippedAlreadyNotified: false,
    };
  }

  const uploadCount = await countWorksheetImportsForServiceMonth(admin, month);
  if (uploadCount < 1) {
    let missingUploadAlerted = false;
    if (!releaseRow?.missing_upload_alert_sent_at) {
      const recipients = await loadMissingUploadAlertRecipients(admin);
      const monthLabel = month.slice(0, 7);
      await Promise.all(
        recipients.map((userId) =>
          notifyUser(admin, {
            userId,
            app: "staff",
            kind: "pre_ets_missing_roster_upload",
            title: `No Pre-ETS spreadsheet for ${monthLabel}`,
            body: `No committed Pre-ETS worksheet was found for service month ${monthLabel}. Upload the spreadsheet so instructors can receive next-month rosters.`,
            link_path: `/dashboard/pre-ets?tab=worksheets&month=${encodeURIComponent(monthLabel)}`,
            metadata: { serviceMonth: month },
          })
        )
      );
      await upsertMonthReleaseRow(admin, month, {
        missing_upload_alert_sent_at: new Date().toISOString(),
      });
      missingUploadAlerted = true;
    }
    return {
      serviceMonth: month,
      releasedIds: [],
      schoolLabels: [],
      recipientSchoolLabels: new Map(),
      missingUploadAlerted,
      skippedBlocked: false,
      skippedAlreadyNotified: Boolean(releaseRow?.missing_upload_alert_sent_at),
    };
  }

  if (releaseRow?.batch_notify_sent_at) {
    // Still release any late-created auths without re-sending the batch notify marker.
    const late = await releaseServiceMonthToField(admin, {
      serviceMonth: month,
      actorUserId: null,
      skipPerAuthNotify: false,
    });
    return {
      serviceMonth: month,
      releasedIds: late.releasedIds,
      schoolLabels: late.schoolLabels,
      recipientSchoolLabels: late.recipientSchoolLabels,
      missingUploadAlerted: false,
      skippedBlocked: late.skippedBlocked,
      skippedAlreadyNotified: true,
    };
  }

  const batch = await releaseServiceMonthToField(admin, {
    serviceMonth: month,
    actorUserId: null,
    skipPerAuthNotify: true,
  });

  return {
    serviceMonth: month,
    releasedIds: batch.releasedIds,
    schoolLabels: batch.schoolLabels,
    recipientSchoolLabels: batch.recipientSchoolLabels,
    missingUploadAlerted: false,
    skippedBlocked: batch.skippedBlocked,
    skippedAlreadyNotified: false,
  };
}

export async function markPreEtsBatchNotifySent(
  admin: SupabaseClient,
  serviceMonth: string
): Promise<void> {
  await upsertMonthReleaseRow(admin, serviceMonth.slice(0, 10), {
    batch_notify_sent_at: new Date().toISOString(),
    batch_released_at: new Date().toISOString(),
  });
}
