import type { SupabaseClient } from "@supabase/supabase-js";
import { isTerminalStageTitle } from "./client-archive";
import { insertRosterClientRecord } from "./client-roster-insert";
import {
  findExactNormalizedCounselor,
  findNearCounselorMatches,
  notifySuperAdminsOfCounselorNearMatch,
} from "./counselor-dedupe";
import { notifyUser } from "./notify-user";
import {
  counselorDisplayStatus,
  intakeStatusLabel,
  referralStageLabel,
} from "./referral-labels";
import {
  isAdminRole,
  isAdminTierRole,
  isHospitalitySpecialistRole,
  isHrRole,
  isSuperAdminRole,
} from "./roles";
import {
  assignReferralFieldSpecialist,
  fieldSpecialistRoleLabel,
  loadDirectReferralAssignEnabled,
  resolveSupervisorUserIdForFieldSpecialist,
} from "./referral-field-specialists";
import {
  filterGaReferralServiceLabels,
  GA_REFERRAL_SERVICE_LABELS,
  GA_WEBSITE_REFERRAL_SERVICES,
} from "./referral-services";

export { loadDirectReferralAssignEnabled } from "./referral-field-specialists";

export type ReferralState = "GA" | "TN";
export type IntakeStatus = "new_referral" | "pending_authorization" | "active" | "discarded";

export {
  filterGaReferralServiceLabels,
  GA_REFERRAL_SERVICE_LABELS,
  GA_WEBSITE_REFERRAL_SERVICES,
} from "./referral-services";

/** Active GA website referral services from Super Admin feature toggles. */
export async function loadGaWebsiteReferralServices(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin
    .from("admin_config")
    .select("traditional_supported_employment_enabled, job_coaching_enabled")
    .limit(1)
    .maybeSingle();

  return filterGaReferralServiceLabels(GA_REFERRAL_SERVICE_LABELS, {
    traditionalSupportedEmploymentEnabled:
      data?.traditional_supported_employment_enabled === true,
    jobCoachingEnabled: data?.job_coaching_enabled === true,
  });
}

export type ReferralFilePayload = {
  name: string;
  mimeType?: string;
  data: string; // base64
} | null;

export type PublicReferralPayload = {
  counselorName: string;
  counselorEmail: string;
  counselorPhone: string;
  service: string;
  clientName: string;
  dob?: string;
  clientPhone?: string;
  clientPhone2?: string;
  clientAddress?: string;
  clientEmail?: string;
  gender?: string;
  ethnicity?: string;
  disability?: string;
  workGoal?: string;
  meetingOption?: string;
  counselorAvailability?: string;
  authorizations?: ReferralFilePayload;
  otherDocs?: ReferralFilePayload;
};

const JT_SUFFIXES = ["@thejoshuatree.org"];

export function isJoshuaTreeEmail(email: string): boolean {
  const e = email.toLowerCase().trim();
  return JT_SUFFIXES.some((s) => e.endsWith(s)) || e.endsWith(".thejoshuatree.org");
}

export function isAllowedReferralCounselorEmail(state: ReferralState, email: string): boolean {
  const e = email.toLowerCase().trim();
  if (!e.includes("@")) return false;
  if (isJoshuaTreeEmail(e)) return true;
  if (state === "GA") return e.endsWith("@gvs.ga.gov");
  return e.endsWith("@tn.gov") || e.endsWith(".tn.gov");
}

/** Map public form service labels → services.name */
export function mapReferralServiceName(state: ReferralState, serviceLabel: string): string | null {
  const s = serviceLabel.trim();
  if (state === "GA") {
    const map: Record<string, string> = {
      "Traditional Supported Employment": "Traditional Supported Employment (GA)",
      "Job Coaching": "Job Coaching (GA)",
      "Individual Job Placement": "Individual Job Placement (GA)",
      "Workplace Readiness Training": "Workplace Readiness Training (GA)",
    };
    return map[s] ?? null;
  }
  const map: Record<string, string> = {
    "Traditional Supported Employment": "Supported Employment (TN)",
    "Individual Job Placement": "Individual Job Placement (TN)",
    "Job Coaching": "Job Coaching (TN)",
    "Job Readiness Training": "Job Readiness Training (TN)",
  };
  return map[s] ?? null;
}

export { counselorDisplayStatus, intakeStatusLabel, referralStageLabel };

export async function loadReferralTrainingPhase(admin: SupabaseClient): Promise<boolean> {
  const { data } = await admin
    .from("admin_config")
    .select("referral_training_phase")
    .limit(1)
    .maybeSingle();
  return data?.referral_training_phase !== false;
}

export async function loadReferralNotifyEmail(admin: SupabaseClient): Promise<string | null> {
  const envEmail = (process.env.REFERRAL_NOTIFY_EMAIL ?? "").trim();
  if (envEmail) return envEmail;
  const { data } = await admin
    .from("admin_config")
    .select("referral_notify_email")
    .limit(1)
    .maybeSingle();
  const fromDb = (data?.referral_notify_email as string | null)?.trim();
  return fromDb || "devon.poole@thejoshuatree.org";
}

/** HR intake notification recipients: hr (+ admin when training on). */
export async function loadHrIntakeRecipientUserIds(admin: SupabaseClient): Promise<string[]> {
  const training = await loadReferralTrainingPhase(admin);
  const roles = training ? ["hr", "admin"] : ["hr"];
  const { data } = await admin.from("profiles").select("id, role").in("role", roles).eq("is_active", true);
  return (data ?? []).map((r) => r.id as string);
}

/** Recipients for post-activation intake work (Intake Calls). */
export async function loadHospitalityIntakeRecipientUserIds(
  admin: SupabaseClient
): Promise<string[]> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["hospitality_specialist", "hr", "admin", "super_admin"])
    .eq("is_active", true);
  return (data ?? []).map((r) => r.id as string);
}

export function canManageReferrals(role: string | null | undefined): boolean {
  return isHrRole(role) || isAdminRole(role) || isSuperAdminRole(role) || isAdminTierRole(role);
}

/** Admin / Super Admin assign ES or TS on Referral Queue when direct assign is enabled. */
export function canAssignReferralFieldSpecialist(role: string | null | undefined): boolean {
  return isAdminRole(role) || isSuperAdminRole(role) || isAdminTierRole(role);
}

/** Align with ES caseload: null/empty intake is treated as active roster. */
export function normalizedClientIntakeStatus(intakeStatus: string | null | undefined): string {
  const s = (intakeStatus ?? "active").trim().toLowerCase();
  return s === "" ? "active" : s;
}

export type ReferralQueueMembershipHints = {
  authorizationNumber?: string | null;
  priorClientId?: string | null;
  hasEsAssignment?: boolean;
};

/** Referral Queue rows (excludes legacy roster clients that are active but never referred). */
export function clientBelongsInReferralQueue(
  intakeStatus: string | null | undefined,
  referredAt: string | null | undefined,
  options: {
    includeActive: boolean;
    allowActiveWithoutReferredAt?: boolean;
  } & ReferralQueueMembershipHints
): boolean {
  const s = normalizedClientIntakeStatus(intakeStatus);
  if (s === "discarded") return false;
  if (s === "new_referral" || s === "pending_authorization") return true;
  if (options.includeActive && s === "active") {
    if ((referredAt ?? "").trim()) return true;
    if (options.allowActiveWithoutReferredAt) return true;
    if ((options.authorizationNumber ?? "").trim()) return true;
    if ((options.priorClientId ?? "").trim()) return true;
    if (options.hasEsAssignment) return true;
    return false;
  }
  return false;
}

/** PostgREST filter for referral queue list queries. */
export function referralQueueListFilter(includeActive: boolean): string {
  if (includeActive) {
    return [
      "intake_status.in.(new_referral,pending_authorization)",
      "and(intake_status.eq.active,referred_at.not.is.null)",
      "and(intake_status.eq.active,referred_at.is.null,authorization_number.not.is.null)",
      "and(intake_status.eq.active,referred_at.is.null,prior_client_id.not.is.null)",
    ].join(",");
  }
  return "intake_status.in.(new_referral,pending_authorization)";
}

const REFERRAL_QUEUE_CLIENT_SELECT =
  "id, full_name, contact_email, intake_status, referral_state, referred_at, intake_status_changed_at, current_service_id, current_stage_id, office_id, counselor_id, authorization_number, date_of_birth, primary_phone, gender, ethnicity, disability_history, created_at, prior_client_id";

const REFERRAL_QUEUE_CLIENT_SELECT_NO_PRIOR = REFERRAL_QUEUE_CLIENT_SELECT.replace(
  ", prior_client_id",
  ""
);

export function referralQueueClientSelectColumns(): string {
  return REFERRAL_QUEUE_CLIENT_SELECT;
}

export function isReferralQueueSearchUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export function referralQueueRowMembership(
  row: {
    intake_status?: string | null;
    referred_at?: string | null;
    authorization_number?: string | null;
    prior_client_id?: string | null;
    id?: string;
  },
  options: {
    includeActive: boolean;
    allowActiveWithoutReferredAt?: boolean;
    assignedClientIds?: Set<string>;
  }
): boolean {
  const clientId = (row.id ?? "").trim();
  return clientBelongsInReferralQueue(row.intake_status, row.referred_at, {
    includeActive: options.includeActive,
    allowActiveWithoutReferredAt: options.allowActiveWithoutReferredAt,
    authorizationNumber: row.authorization_number,
    priorClientId: row.prior_client_id,
    hasEsAssignment: clientId ? options.assignedClientIds?.has(clientId) : false,
  });
}

/** Active pipeline clients assigned to ES/TS but missing referred_at (post-activation edge cases). */
export async function loadReferralQueueEsAssignedExtras(
  admin: SupabaseClient,
  existingIds: Set<string>,
  includeActive: boolean
): Promise<Array<Record<string, unknown>>> {
  if (!includeActive) return [];

  const { data: links } = await admin.from("es_client_assignments").select("client_id");
  const candidateIds = [
    ...new Set(
      (links ?? [])
        .map((l) => l.client_id as string)
        .filter((id) => id && !existingIds.has(id))
    ),
  ].slice(0, 300);
  if (candidateIds.length === 0) return [];

  let { data: rows, error } = await admin
    .from("clients")
    .select(REFERRAL_QUEUE_CLIENT_SELECT)
    .in("id", candidateIds);
  if (error?.message.includes("prior_client_id")) {
    const fallback = await admin
      .from("clients")
      .select(REFERRAL_QUEUE_CLIENT_SELECT_NO_PRIOR)
      .in("id", candidateIds);
    rows = fallback.data as typeof rows;
    error = fallback.error;
  }
  if (error || !rows?.length) return [];

  const assigned = new Set(candidateIds);
  return rows.filter((row) =>
    referralQueueRowMembership(row, {
      includeActive: true,
      assignedClientIds: assigned,
    })
  ) as Array<Record<string, unknown>>;
}

export function canAccessHospitalityIntake(role: string | null | undefined): boolean {
  return isHospitalitySpecialistRole(role) || canManageReferrals(role);
}

/** Prefer the counselor directory office, then the first counselor ↔ office assignment. */
export async function resolveCounselorOfficeId(
  admin: SupabaseClient,
  counselorId: string
): Promise<string | null> {
  const { data: counselor } = await admin
    .from("counselors")
    .select("office_id")
    .eq("id", counselorId)
    .maybeSingle();
  const fromDirectory = (counselor?.office_id as string | null) ?? null;
  if (fromDirectory) return fromDirectory;

  const { data: links } = await admin
    .from("counselor_office_assignments")
    .select("office_id")
    .eq("counselor_id", counselorId)
    .limit(1);
  return ((links?.[0]?.office_id as string | null) ?? null);
}

export async function findOrCreateReferralCounselor(
  admin: SupabaseClient,
  opts: { fullName: string; email: string; phone?: string }
): Promise<{ counselorId: string } | { error: string }> {
  const email = opts.email.toLowerCase().trim();
  const fullName = opts.fullName.replace(/\s+/g, " ").trim();
  if (!email || !fullName) return { error: "Counselor name and email are required" };

  const { data: byEmail } = await admin
    .from("counselors")
    .select("id, office_id, user_id")
    .ilike("contact_email", email)
    .maybeSingle();

  if (byEmail?.id) {
    return { counselorId: byEmail.id as string };
  }

  const { data: withUser } = await admin
    .from("counselors")
    .select("id, user_id, contact_email")
    .not("user_id", "is", null)
    .limit(2000);

  try {
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const authUser = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (authUser) {
      const linked = (withUser ?? []).find((c) => c.user_id === authUser.id);
      if (linked?.id) {
        await admin
          .from("counselors")
          .update({ contact_email: email, full_name: fullName })
          .eq("id", linked.id);
        return { counselorId: linked.id as string };
      }
    }
  } catch {
    // ignore auth list failures; fall through
  }

  const exactNameHits = await findExactNormalizedCounselor(admin, fullName);
  if (exactNameHits.length === 1) {
    const hit = exactNameHits[0];
    const existingEmail = (hit.contact_email ?? "").trim().toLowerCase();
    if (!existingEmail || existingEmail === email) {
      if (!existingEmail) {
        await admin.from("counselors").update({ contact_email: email }).eq("id", hit.id);
      }
      return { counselorId: hit.id };
    }
  }

  const { data: inserted, error } = await admin
    .from("counselors")
    .insert({
      full_name: fullName,
      office_id: null,
      contact_email: email,
      user_id: null,
    })
    .select("id")
    .single();

  if (error || !inserted?.id) {
    return { error: error?.message ?? "Could not create counselor directory entry" };
  }

  const near = await findNearCounselorMatches(admin, {
    fullName,
    excludeId: inserted.id as string,
  });
  if (near.length) {
    await notifySuperAdminsOfCounselorNearMatch(admin, {
      newCounselorId: inserted.id as string,
      newCounselorName: fullName,
      matches: near,
    });
  }

  return { counselorId: inserted.id as string };
}

async function resolveServiceId(
  admin: SupabaseClient,
  serviceName: string
): Promise<string | null> {
  const { data } = await admin.from("services").select("id, name").ilike("name", serviceName).maybeSingle();
  if (data?.id) return data.id as string;
  const { data: all } = await admin.from("services").select("id, name");
  const hit = (all ?? []).find((s) => (s.name as string).toLowerCase() === serviceName.toLowerCase());
  return (hit?.id as string) ?? null;
}

function parseAddress(address: string | undefined): {
  line1: string | null;
  city: string | null;
  state: "GA" | "TN" | null;
  zip: string | null;
} {
  const raw = (address ?? "").trim();
  if (!raw) return { line1: null, city: null, state: null, zip: null };
  const zipMatch = raw.match(/\b(\d{5})(?:-\d{4})?\b/);
  const zip = zipMatch?.[1] ?? null;
  const stateMatch = raw.match(/\b(GA|TN)\b/i);
  const state = stateMatch ? (stateMatch[1].toUpperCase() as "GA" | "TN") : null;
  return { line1: raw, city: null, state, zip };
}

export async function findPossibleDuplicateClients(
  admin: SupabaseClient,
  opts: { fullName: string; dateOfBirth?: string | null; contactEmail?: string | null }
): Promise<
  Array<{
    id: string;
    full_name: string | null;
    contact_email: string | null;
    archived_at?: string | null;
  }>
> {
  const results: Array<{
    id: string;
    full_name: string | null;
    contact_email: string | null;
    archived_at?: string | null;
  }> = [];
  const email = (opts.contactEmail ?? "").trim().toLowerCase();
  if (email) {
    const emailQuery = await admin
      .from("clients")
      .select("id, full_name, contact_email, archived_at")
      .ilike("contact_email", email)
      .neq("intake_status", "discarded")
      .limit(5);
    const emailRows = emailQuery.error?.message.includes("archived_at")
      ? (
          await admin
            .from("clients")
            .select("id, full_name, contact_email")
            .ilike("contact_email", email)
            .neq("intake_status", "discarded")
            .limit(5)
        ).data
      : emailQuery.data;
    for (const row of emailRows ?? []) results.push(row as (typeof results)[number]);
  }
  const name = opts.fullName.trim();
  const dob = (opts.dateOfBirth ?? "").trim();
  if (name && dob) {
    const dobQuery = await admin
      .from("clients")
      .select("id, full_name, contact_email, date_of_birth, archived_at")
      .eq("date_of_birth", dob)
      .neq("intake_status", "discarded")
      .limit(20);
    const dobRows = dobQuery.error?.message.includes("archived_at")
      ? (
          await admin
            .from("clients")
            .select("id, full_name, contact_email, date_of_birth")
            .eq("date_of_birth", dob)
            .neq("intake_status", "discarded")
            .limit(20)
        ).data
      : dobQuery.data;
    for (const row of dobRows ?? []) {
      const n = ((row as { full_name?: string }).full_name ?? "").trim().toLowerCase();
      if (n && n === name.toLowerCase() && !results.some((r) => r.id === row.id)) {
        results.push({
          id: row.id as string,
          full_name: (row as { full_name?: string }).full_name ?? null,
          contact_email: (row as { contact_email?: string }).contact_email ?? null,
          archived_at: (row as { archived_at?: string | null }).archived_at ?? null,
        });
      }
    }
  }
  return results;
}

async function uploadReferralFile(
  admin: SupabaseClient,
  clientId: string,
  kind: "authorizations" | "other",
  file: ReferralFilePayload
): Promise<void> {
  if (!file?.data || !file.name) return;
  const bytes = Buffer.from(file.data, "base64");
  const safeName = file.name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
  const path = `${clientId}/${kind}-${Date.now()}-${safeName}`;
  const { error: upErr } = await admin.storage.from("referral-docs").upload(path, bytes, {
    contentType: file.mimeType || "application/octet-stream",
    upsert: false,
  });
  if (upErr) {
    console.error("referral doc upload failed:", upErr.message);
    return;
  }
  await admin.from("client_referral_documents").insert({
    client_id: clientId,
    kind,
    file_name: file.name,
    storage_path: path,
    mime_type: file.mimeType ?? null,
  });
}

export async function createPublicReferral(
  admin: SupabaseClient,
  state: ReferralState,
  payload: PublicReferralPayload,
  opts?: {
    source?: "website" | "manual";
    actorUserId?: string | null;
    /** Staff manual entry may use any counselor email; website still enforces allowlist. */
    skipCounselorEmailAllowlist?: boolean;
  }
): Promise<
  | {
      clientId: string;
      counselorId: string;
      duplicates: Array<{ id: string; full_name: string | null }>;
      serviceName: string;
    }
  | { error: string; status?: number }
> {
  const counselorEmail = (payload.counselorEmail ?? "").toLowerCase().trim();
  const source = opts?.source ?? "website";
  if (!counselorEmail.includes("@")) {
    return { error: "Counselor email is required", status: 400 };
  }
  if (!opts?.skipCounselorEmailAllowlist && !isAllowedReferralCounselorEmail(state, counselorEmail)) {
    return {
      error:
        state === "GA"
          ? "Unauthorized Access: only official email addresses allowed."
          : "That email address isn't authorized. Please use your official email address.",
      status: 403,
    };
  }

  const counselorName = (payload.counselorName ?? "").trim();
  if (!counselorName) {
    return { error: "Counselor name is required", status: 400 };
  }
  if (!(payload.counselorPhone ?? "").trim()) {
    return { error: "Counselor phone is required", status: 400 };
  }

  const serviceLabel = (payload.service ?? "").trim();
  if (state === "GA" && source === "website") {
    const allowedServices = await loadGaWebsiteReferralServices(admin);
    if (!allowedServices.includes(serviceLabel)) {
      return {
        error: `Invalid service requested. Choose one of: ${allowedServices.join(", ")}.`,
        status: 400,
      };
    }
  }

  const serviceName = mapReferralServiceName(state, serviceLabel);
  if (!serviceName) {
    return { error: "Invalid service requested", status: 400 };
  }
  const serviceId = await resolveServiceId(admin, serviceName);
  if (!serviceId) {
    return { error: `Service not configured: ${serviceName}`, status: 500 };
  }

  const clientName = (payload.clientName ?? "").trim();
  if (!clientName) {
    return { error: "Client name is required", status: 400 };
  }

  const counselor = await findOrCreateReferralCounselor(admin, {
    fullName: counselorName,
    email: counselorEmail,
    phone: payload.counselorPhone,
  });
  if ("error" in counselor) {
    return { error: counselor.error, status: 500 };
  }

  const officeId = await resolveCounselorOfficeId(admin, counselor.counselorId);
  const addr = parseAddress(payload.clientAddress);
  const nowIso = new Date().toISOString();

  const duplicates = await findPossibleDuplicateClients(admin, {
    fullName: clientName,
    dateOfBirth: payload.dob,
    contactEmail: payload.clientEmail,
  });

  const created = await insertRosterClientRecord(admin, {
    fullName: clientName,
    counselorId: counselor.counselorId,
    officeId,
    serviceId,
    stageId: null,
    contactEmail: payload.clientEmail,
    employmentGoalPrimary: payload.workGoal ?? null,
  });
  if ("error" in created) {
    return { error: created.error, status: 500 };
  }

  const closedPrior = [...duplicates]
    .filter((d) => d.archived_at)
    .sort((a, b) => String(b.archived_at).localeCompare(String(a.archived_at)))[0];

  const patch: Record<string, unknown> = {
    intake_status: "new_referral",
    ...(closedPrior ? { prior_client_id: closedPrior.id } : {}),
    intake_status_changed_at: nowIso,
    referral_state: state,
    referred_at: nowIso,
    last_activity_at: nowIso,
    date_of_birth: payload.dob?.trim() || null,
    primary_phone: payload.clientPhone?.trim() || null,
    secondary_phone: payload.clientPhone2?.trim() || null,
    gender: payload.gender?.trim() || null,
    ethnicity: payload.ethnicity?.trim() || null,
    disability_history: payload.disability?.trim() || null,
    meeting_preference: payload.meetingOption?.trim() || null,
    counselor_availability: payload.counselorAvailability?.trim() || null,
    home_address_line1: addr.line1,
    home_city: addr.city,
    home_state: addr.state ?? (state === "GA" || state === "TN" ? state : null),
    home_zip: addr.zip,
  };

  let { error: patchErr } = await admin.from("clients").update(patch).eq("id", created.id);
  if (patchErr?.message.includes("prior_client_id") && patch.prior_client_id) {
    delete patch.prior_client_id;
    const retry = await admin.from("clients").update(patch).eq("id", created.id);
    patchErr = retry.error;
  }
  if (patchErr) {
    return { error: patchErr.message, status: 500 };
  }

  const { resolveParticipantForClient } = await import("./participants");
  await resolveParticipantForClient(admin, {
    clientId: created.id,
    fullName: clientName,
    dateOfBirth: payload.dob ?? null,
    contactEmail: payload.clientEmail ?? null,
  }).catch(() => undefined);

  await admin.from("client_intake_events").insert({
    client_id: created.id,
    actor_user_id: opts?.actorUserId ?? null,
    event_type: "referral_submitted",
    to_value: "new_referral",
    metadata: {
      state,
      service: serviceName,
      counselorEmail,
      source,
      possibleDuplicates: duplicates.map((d) => d.id),
    },
  });

  await uploadReferralFile(admin, created.id, "authorizations", payload.authorizations ?? null);
  await uploadReferralFile(admin, created.id, "other", payload.otherDocs ?? null);

  return {
    clientId: created.id,
    counselorId: counselor.counselorId,
    duplicates,
    serviceName,
  };
}

/** Fixed middle section of referral emails (not editable in Super Admin templates). */
export function buildReferralDetailsBlock(opts: {
  payload: PublicReferralPayload;
  serviceName: string;
  authFileName: string;
  otherFileName: string;
}): string {
  return `
--- COUNSELOR INFORMATION ---
Name: ${opts.payload.counselorName}
Email: ${opts.payload.counselorEmail}
Phone: ${opts.payload.counselorPhone}

--- SERVICE REQUESTED ---
${opts.serviceName}

--- CLIENT REFERRAL DETAILS ---
Client Name: ${opts.payload.clientName}
Date of Birth: ${opts.payload.dob ?? ""}
Primary Phone: ${opts.payload.clientPhone ?? ""}
Secondary Phone: ${opts.payload.clientPhone2 || "N/A"}
Address: ${opts.payload.clientAddress ?? ""}
Email Address: ${opts.payload.clientEmail ?? ""}
Gender: ${opts.payload.gender ?? ""}
Ethnicity/Race: ${opts.payload.ethnicity ?? ""}

Disability/History:
${opts.payload.disability ?? ""}

Client's Work Goal:
${opts.payload.workGoal || "N/A"}

Meeting Option: ${opts.payload.meetingOption ?? ""}
Counselor Availability: ${opts.payload.counselorAvailability ?? ""}

--- UPLOADED FILES ---
Authorizations: ${opts.authFileName}
Other Documents: ${opts.otherFileName}
`.trim();
}

export async function buildReferralEmailBodies(
  admin: SupabaseClient,
  opts: {
    state: ReferralState;
    payload: PublicReferralPayload;
    serviceName: string;
    authFileName: string;
    otherFileName: string;
  }
): Promise<{
  adminSubject: string;
  adminBody: string;
  counselorSubject: string;
  counselorBody: string;
}> {
  const {
    loadResolvedEmailTemplate,
    renderReferralSectionalEmail,
  } = await import("./email-templates");

  const agencyLabel = opts.state === "GA" ? "GVRA" : "Tennessee VR";
  const vars = {
    agency_label: agencyLabel,
    client_name: opts.payload.clientName,
    counselor_name: opts.payload.counselorName,
    service_name: opts.serviceName,
  };
  const detailsBlock = buildReferralDetailsBlock(opts);

  const [adminTpl, counselorTpl] = await Promise.all([
    loadResolvedEmailTemplate(admin, "referral_admin_notice"),
    loadResolvedEmailTemplate(admin, "referral_counselor_confirmation"),
  ]);

  const adminMail = renderReferralSectionalEmail(adminTpl, { vars, detailsBlock });
  const counselorMail = renderReferralSectionalEmail(counselorTpl, { vars, detailsBlock });

  return {
    adminSubject: adminMail.subject,
    adminBody: adminMail.text,
    counselorSubject: counselorMail.subject,
    counselorBody: counselorMail.text,
  };
}

export async function notifyHrOfNewReferral(
  admin: SupabaseClient,
  opts: { clientId: string; clientName: string; state: ReferralState }
): Promise<void> {
  const userIds = await loadHrIntakeRecipientUserIds(admin);
  for (const userId of userIds) {
    await notifyUser(admin, {
      userId,
      app: "staff",
      kind: "referral_new",
      title: `New ${opts.state} referral: ${opts.clientName}`,
      body: "A counselor submitted a referral. Review in the Referral Queue.",
      link_path: `/dashboard/referrals/${opts.clientId}`,
      metadata: { clientId: opts.clientId, state: opts.state },
    });
  }
}

export async function touchClientActivity(admin: SupabaseClient, clientId: string): Promise<void> {
  await admin.from("clients").update({ last_activity_at: new Date().toISOString() }).eq("id", clientId);
}

/**
 * Show on an assigned ES/TS caseload. Includes referral-queue rows assigned before activation
 * (direct assign flow). Counselors use a separate portal.
 */
export function intakeVisibleToFieldStaff(intakeStatus: string | null | undefined): boolean {
  const s = (intakeStatus ?? "active").trim().toLowerCase();
  if (s === "discarded") return false;
  return (
    s === "active" ||
    s === "new_referral" ||
    s === "pending_authorization" ||
    s === ""
  );
}

export async function isPhase1IntakeStage(
  admin: SupabaseClient,
  stageId: string | null | undefined
): Promise<boolean> {
  if (!stageId) return false;
  const { data } = await admin.from("service_milestones").select("title, name").eq("id", stageId).maybeSingle();
  const title = `${data?.title ?? ""} ${data?.name ?? ""}`;
  return /phase\s*1\s*:\s*intake/i.test(title) || /^intake$/i.test((data?.title as string)?.trim() ?? "");
}

export async function isGaTseService(admin: SupabaseClient, serviceId: string | null | undefined): Promise<boolean> {
  if (!serviceId) return false;
  const { data } = await admin.from("services").select("name").eq("id", serviceId).maybeSingle();
  return (data?.name as string) === "Traditional Supported Employment (GA)";
}

export async function activateReferralToFirstStage(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    actorUserId: string;
    authorizationNumber?: string | null;
    overrideReason?: string | null;
    stageId?: string | null;
  }
): Promise<{ ok: true } | { error: string }> {
  const { data: client, error } = await admin
    .from("clients")
    .select(
      "id, full_name, contact_email, intake_status, authorization_number, current_service_id, current_stage_id, office_id, counselor_id, referred_at"
    )
    .eq("id", opts.clientId)
    .maybeSingle();

  if (error || !client) return { error: error?.message ?? "Client not found" };

  const authNumber = (opts.authorizationNumber ?? client.authorization_number ?? "").trim();
  const override = (opts.overrideReason ?? "").trim();
  if (!authNumber && !override) {
    return {
      error: "Enter an authorization number, or provide an override reason to activate without one.",
    };
  }

  const serviceId = client.current_service_id as string | null;
  if (!serviceId) return { error: "Client has no service assigned" };

  let stageId = opts.stageId?.trim() || null;
  if (!stageId) {
    const { data: first } = await admin
      .from("service_milestones")
      .select("id")
      .eq("service_id", serviceId)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    stageId = (first?.id as string) ?? null;
  }
  if (!stageId) return { error: "No first stage found for this service" };

  const directAssign = await loadDirectReferralAssignEnabled(admin);
  let assigneeUserId: string | null = null;
  let assigneeRole: string | null = null;
  let assigneeName = "";

  if (directAssign) {
    const { data: assigneeLink } = await admin
      .from("es_client_assignments")
      .select("es_user_id")
      .eq("client_id", opts.clientId)
      .maybeSingle();
    assigneeUserId = (assigneeLink?.es_user_id as string | null) ?? null;
    if (!assigneeUserId) {
      return {
        error: "Assign an Employment or Transition Specialist before activating.",
      };
    }

    const { data: assigneeProfile } = await admin
      .from("profiles")
      .select("full_name, role")
      .eq("id", assigneeUserId)
      .maybeSingle();
    assigneeRole = (assigneeProfile?.role as string | null) ?? null;
    assigneeName = (assigneeProfile?.full_name as string | null)?.trim() || assigneeUserId;

    const supervisorId = await resolveSupervisorUserIdForFieldSpecialist(
      admin,
      assigneeUserId,
      client.office_id as string | null
    );
    if (supervisorId) {
      await admin
        .from("clients")
        .update({ supervisor_user_id: supervisorId })
        .eq("id", opts.clientId);
    }
  }

  const nowIso = new Date().toISOString();
  const referredAt = (client.referred_at as string | null | undefined)?.trim() || nowIso;
  const { error: updErr } = await admin
    .from("clients")
    .update({
      intake_status: "active",
      intake_status_changed_at: nowIso,
      last_activity_at: nowIso,
      current_stage_id: stageId,
      authorization_number: authNumber || client.authorization_number,
      authorization_override_reason: authNumber ? null : override,
      referred_at: referredAt,
    })
    .eq("id", opts.clientId);

  if (updErr) return { error: updErr.message };

  const { data: clientRow } = await admin
    .from("clients")
    .select("participant_id, full_name, contact_email, date_of_birth")
    .eq("id", opts.clientId)
    .maybeSingle();

  const { resolveParticipantForClient } = await import("./participants");
  const { ensureServiceEpisodeForActivation } = await import("./service-episodes");

  let participantId = (clientRow?.participant_id as string | null) ?? null;
  if (!participantId && clientRow) {
    const match = await resolveParticipantForClient(admin, {
      clientId: opts.clientId,
      fullName: String(clientRow.full_name ?? ""),
      dateOfBirth: (clientRow.date_of_birth as string | null) ?? null,
      contactEmail: (clientRow.contact_email as string | null) ?? null,
    });
    if (match.kind !== "none") {
      participantId = match.participantId;
    }
  }

  await ensureServiceEpisodeForActivation(admin, {
    clientId: opts.clientId,
    serviceId,
    authorizationNumber: authNumber || override || "PENDING",
    participantId,
  }).catch(() => undefined);

  await admin.from("client_intake_events").insert({
    client_id: opts.clientId,
    actor_user_id: opts.actorUserId,
    event_type: "activated",
    from_value: client.intake_status as string,
    to_value: "active",
    reason: authNumber ? null : override,
    metadata: { stageId, authorizationNumber: authNumber || null },
  });

  const clientLabel =
    (client.full_name as string)?.trim() ||
    (client.contact_email as string)?.trim() ||
    opts.clientId;

  const assigneeLabel =
    directAssign && assigneeUserId
      ? `${fieldSpecialistRoleLabel(assigneeRole)}: ${assigneeName}`
      : null;

  const officeId = client.office_id as string | null;
  if (officeId) {
    const { data: staffLinks } = await admin
      .from("staff_office_assignments")
      .select("user_id")
      .eq("office_id", officeId);
    const staffIds = [...new Set((staffLinks ?? []).map((r) => r.user_id as string))];
    if (staffIds.length) {
      const { data: supers } = await admin
        .from("profiles")
        .select("id, role")
        .in("id", staffIds)
        .eq("role", "supervisor")
        .eq("is_active", true);
      for (const s of supers ?? []) {
        await notifyUser(admin, {
          userId: s.id as string,
          app: "staff",
          kind: "referral_new_client",
          title: assigneeLabel
            ? `New client assigned to ${assigneeLabel}`
            : `New client: ${clientLabel}`,
          body: assigneeLabel
            ? "A referral was activated and assigned to a field specialist. Review referral details and casework."
            : "A referral was activated to the first service stage.",
          link_path: `/dashboard/referrals/${opts.clientId}`,
          metadata: { clientId: opts.clientId, assigneeUserId },
        });
      }
    }
  }

  const { data: esLinks } = await admin
    .from("es_client_assignments")
    .select("es_user_id")
    .eq("client_id", opts.clientId);
  for (const link of esLinks ?? []) {
    await notifyUser(admin, {
      userId: link.es_user_id as string,
      app: "staff",
      kind: "referral_new_client",
      title: `New client: ${clientLabel}`,
      body: directAssign
        ? `You were assigned this referral. Review referral details, then open the client record for casework. Referral: /dashboard/referrals/${opts.clientId}`
        : "A referral was activated and assigned to your caseload.",
      link_path: `/dashboard/clients/${opts.clientId}`,
      metadata: { clientId: opts.clientId, referralPath: `/dashboard/referrals/${opts.clientId}` },
    });
  }

  if (!directAssign) {
    await admin.from("hospitality_intake_tasks").upsert(
      {
        client_id: opts.clientId,
        status: "open",
        created_at: nowIso,
        completed_at: null,
        completed_by: null,
      },
      { onConflict: "client_id" }
    );
    const intakeRecipients = await loadHospitalityIntakeRecipientUserIds(admin);
    for (const userId of intakeRecipients) {
      await notifyUser(admin, {
        userId,
        app: "staff",
        kind: "referral_needs_intake",
        title: `New client ready to start: ${clientLabel}`,
        body: "New client ready to start — review referral and assign supervisor.",
        link_path: `/dashboard/intake/calls/${opts.clientId}`,
        metadata: { clientId: opts.clientId },
      });
    }
  }

  return { ok: true };
}

export async function linkReferralPriorEnrollment(
  admin: SupabaseClient,
  opts: { clientId: string; priorClientId: string | null; actorUserId: string }
): Promise<{ ok: true } | { error: string }> {
  if (opts.priorClientId) {
    if (opts.priorClientId === opts.clientId) {
      return { error: "Cannot link a referral to itself." };
    }
    const { data: prior, error: priorErr } = await admin
      .from("clients")
      .select("id, archived_at")
      .eq("id", opts.priorClientId)
      .maybeSingle();
    if (priorErr) return { error: priorErr.message };
    if (!prior) return { error: "Previous enrollment not found." };
    const closure = await isPriorEnrollmentClosed(admin, opts.priorClientId);
    if (!closure.closed) {
      return { error: closure.error };
    }
  }

  const { error } = await admin
    .from("clients")
    .update({ prior_client_id: opts.priorClientId })
    .eq("id", opts.clientId);
  if (error) {
    if (error.message.includes("prior_client_id")) {
      return {
        error:
          "Previous enrollment linking is not available yet. Apply the latest database migration.",
      };
    }
    return { error: error.message };
  }

  await admin.from("client_intake_events").insert({
    client_id: opts.clientId,
    actor_user_id: opts.actorUserId,
    event_type: "prior_enrollment_linked",
    to_value: opts.priorClientId,
  });
  return { ok: true };
}

const PRIOR_ENROLLMENT_CLIENT_SELECT =
  "id, full_name, contact_email, counselor_id, office_id, current_service_id, referral_state, archived_at, current_stage_id, date_of_birth, primary_phone, secondary_phone, gender, ethnicity, disability_history, employment_goal_primary, employment_goal_secondary, employment_goal_primary_other, employment_goal_secondary_other, home_address_line1, home_address_line2, home_city, home_state, home_zip, meeting_preference, counselor_availability, intake_status";

export function priorEnrollmentOutcomeLabel(
  stageTitle: string | null | undefined
): string | null {
  const t = (stageTitle ?? "").trim();
  if (!t) return null;
  if (isTerminalStageTitle(t)) return t;
  return null;
}

async function loadMilestoneTitle(
  admin: SupabaseClient,
  stageId: string | null | undefined
): Promise<string | null> {
  if (!stageId) return null;
  const { data } = await admin
    .from("service_milestones")
    .select("title, name")
    .eq("id", stageId)
    .maybeSingle();
  return ((data?.title as string | null) || (data?.name as string | null) || "").trim() || null;
}

/** Prior enrollment ended (Complete, Dismissed, Closed, etc.) — eligible to start a new service episode. */
export async function isPriorEnrollmentClosed(
  admin: SupabaseClient,
  priorClientId: string
): Promise<{ closed: true; outcomeLabel: string | null } | { closed: false; error: string }> {
  const { data: prior, error } = await admin
    .from("clients")
    .select(PRIOR_ENROLLMENT_CLIENT_SELECT)
    .eq("id", priorClientId)
    .maybeSingle();
  if (error) return { closed: false, error: error.message };
  if (!prior) return { closed: false, error: "Previous enrollment not found." };

  const archivedAt = (prior as { archived_at?: string | null }).archived_at;
  if (archivedAt) {
    const stageTitle = await loadMilestoneTitle(
      admin,
      (prior as { current_stage_id?: string | null }).current_stage_id ?? null
    );
    return { closed: true, outcomeLabel: priorEnrollmentOutcomeLabel(stageTitle) };
  }

  const stageTitle = await loadMilestoneTitle(
    admin,
    (prior as { current_stage_id?: string | null }).current_stage_id ?? null
  );
  if (isTerminalStageTitle(stageTitle)) {
    return { closed: true, outcomeLabel: priorEnrollmentOutcomeLabel(stageTitle) };
  }

  return {
    closed: false,
    error: "Previous enrollment must be Complete, Dismissed, or Closed before starting a new service.",
  };
}

export async function searchPriorEnrollmentsForNewService(
  admin: SupabaseClient,
  query: string
): Promise<
  Array<{
    id: string;
    full_name: string | null;
    archived_at: string | null;
    outcomeLabel: string | null;
  }>
> {
  const q = query.trim();
  if (q.length < 2) return [];

  const { data: rows, error } = await admin
    .from("clients")
    .select("id, full_name, archived_at, current_stage_id")
    .ilike("full_name", `%${q.replace(/%/g, "")}%`)
    .not("archived_at", "is", null)
    .neq("intake_status", "discarded")
    .order("archived_at", { ascending: false })
    .limit(15);

  if (error?.message.includes("archived_at")) {
    return [];
  }

  const out: Array<{
    id: string;
    full_name: string | null;
    archived_at: string | null;
    outcomeLabel: string | null;
  }> = [];

  for (const row of rows ?? []) {
    const stageTitle = await loadMilestoneTitle(
      admin,
      (row as { current_stage_id?: string | null }).current_stage_id ?? null
    );
    out.push({
      id: row.id as string,
      full_name: (row as { full_name?: string | null }).full_name ?? null,
      archived_at: (row as { archived_at?: string | null }).archived_at ?? null,
      outcomeLabel: priorEnrollmentOutcomeLabel(stageTitle),
    });
  }
  return out;
}

function formatPriorClientAddress(row: {
  home_address_line1?: string | null;
  home_address_line2?: string | null;
  home_city?: string | null;
  home_state?: string | null;
  home_zip?: string | null;
}): string {
  const line1 = (row.home_address_line1 ?? "").trim();
  const line2 = (row.home_address_line2 ?? "").trim();
  const city = (row.home_city ?? "").trim();
  const state = (row.home_state ?? "").trim();
  const zip = (row.home_zip ?? "").trim();
  const cityStateZip = [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : "");
  return [line1, line2, cityStateZip.trim()].filter(Boolean).join(", ");
}

function normalizeReferralDobForInput(dob: string | null | undefined): string {
  const raw = (dob ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return raw;
}

/** Pre-fill a returning-client referral form from a closed prior enrollment. */
export async function loadPriorEnrollmentReferralDraft(
  admin: SupabaseClient,
  priorClientId: string
): Promise<
  | {
      ok: true;
      priorClientId: string;
      priorOutcomeLabel: string | null;
      priorReferredAt: string | null;
      state: ReferralState;
      draft: PublicReferralPayload;
    }
  | { error: string }
> {
  const closure = await isPriorEnrollmentClosed(admin, priorClientId);
  if (!closure.closed) return { error: closure.error };

  const { data: prior, error: priorErr } = await admin
    .from("clients")
    .select(`${PRIOR_ENROLLMENT_CLIENT_SELECT}, referred_at`)
    .eq("id", priorClientId)
    .maybeSingle();
  if (priorErr) return { error: priorErr.message };
  if (!prior) return { error: "Previous enrollment not found." };

  let counselorName = "";
  let counselorEmail = "";
  let counselorPhone = "";
  const counselorId = (prior as { counselor_id?: string | null }).counselor_id;
  if (counselorId) {
    const { data: counselor } = await admin
      .from("counselors")
      .select("full_name, contact_email")
      .eq("id", counselorId)
      .maybeSingle();
    counselorName = (counselor?.full_name as string | null)?.trim() ?? "";
    counselorEmail = (counselor?.contact_email as string | null)?.trim() ?? "";
  }

  let serviceLabel = "";
  const serviceId = (prior as { current_service_id?: string | null }).current_service_id;
  if (serviceId) {
    const { data: service } = await admin.from("services").select("name").eq("id", serviceId).maybeSingle();
    const { gaServiceNameToReferralLabel } = await import("./referral-services");
    serviceLabel = gaServiceNameToReferralLabel((service?.name as string) ?? "");
  }

  const referralState =
    ((prior as { referral_state?: string | null }).referral_state as ReferralState | null) ?? "GA";

  const draft: PublicReferralPayload = {
    counselorName,
    counselorEmail,
    counselorPhone,
    service: serviceLabel,
    clientName: ((prior as { full_name?: string }).full_name ?? "").trim(),
    dob: normalizeReferralDobForInput((prior as { date_of_birth?: string | null }).date_of_birth),
    clientPhone: (prior as { primary_phone?: string | null }).primary_phone?.trim() ?? "",
    clientPhone2: (prior as { secondary_phone?: string | null }).secondary_phone?.trim() ?? "",
    clientAddress: formatPriorClientAddress(prior as Record<string, string | null>),
    clientEmail: (prior as { contact_email?: string | null }).contact_email?.trim() ?? "",
    gender: (prior as { gender?: string | null }).gender?.trim() ?? "",
    ethnicity: (prior as { ethnicity?: string | null }).ethnicity?.trim() ?? "",
    disability: (prior as { disability_history?: string | null }).disability_history?.trim() ?? "",
    workGoal: (prior as { employment_goal_primary?: string | null }).employment_goal_primary?.trim() ?? "",
    meetingOption: (prior as { meeting_preference?: string | null }).meeting_preference?.trim() ?? "",
    counselorAvailability:
      (prior as { counselor_availability?: string | null }).counselor_availability?.trim() ?? "",
  };

  return {
    ok: true,
    priorClientId,
    priorOutcomeLabel: closure.outcomeLabel,
    priorReferredAt: (prior as { referred_at?: string | null }).referred_at ?? null,
    state: referralState === "TN" ? "TN" : "GA",
    draft,
  };
}

/**
 * Create a new referral queue row from a closed prior enrollment (no auto-activation).
 * Authorization # and ES/TS assignment happen in the queue like any other referral.
 */
export async function createReferralFromPriorEnrollment(
  admin: SupabaseClient,
  opts: {
    priorClientId: string;
    actorUserId: string;
    state: ReferralState;
    payload: PublicReferralPayload;
    source?: "manual" | "begin_new_service";
  }
): Promise<{ ok: true; clientId: string } | { error: string }> {
  const closure = await isPriorEnrollmentClosed(admin, opts.priorClientId);
  if (!closure.closed) return { error: closure.error };

  const state = opts.state;
  if (state !== "GA") {
    return { error: "Begin New Service is only supported for GA referrals right now." };
  }

  const payload = opts.payload;
  const counselorName = (payload.counselorName ?? "").trim();
  const counselorEmail = (payload.counselorEmail ?? "").trim();
  if (!counselorName || !counselorEmail) {
    return { error: "Counselor name and email are required." };
  }

  const serviceLabel = (payload.service ?? "").trim();
  if (!serviceLabel) {
    return { error: "Select a service for the new enrollment." };
  }

  const serviceName = mapReferralServiceName(state, serviceLabel);
  if (!serviceName) {
    return { error: "Invalid service selected." };
  }
  const serviceId = await resolveServiceId(admin, serviceName);
  if (!serviceId) {
    return { error: `Service not configured: ${serviceName}` };
  }

  const clientName = (payload.clientName ?? "").trim();
  if (!clientName) {
    return { error: "Client name is required." };
  }

  const counselor = await findOrCreateReferralCounselor(admin, {
    fullName: counselorName,
    email: counselorEmail,
    phone: payload.counselorPhone,
  });
  if ("error" in counselor) {
    return { error: counselor.error };
  }

  const officeId = await resolveCounselorOfficeId(admin, counselor.counselorId);
  const addr = parseAddress(payload.clientAddress);
  const nowIso = new Date().toISOString();

  const created = await insertRosterClientRecord(admin, {
    fullName: clientName,
    counselorId: counselor.counselorId,
    officeId,
    serviceId,
    stageId: null,
    contactEmail: payload.clientEmail,
    employmentGoalPrimary: payload.workGoal ?? null,
  });
  if ("error" in created) return { error: created.error };

  const patch: Record<string, unknown> = {
    intake_status: "new_referral",
    intake_status_changed_at: nowIso,
    referral_state: state,
    referred_at: nowIso,
    last_activity_at: nowIso,
    prior_client_id: opts.priorClientId,
    authorization_number: null,
    authorization_override_reason: null,
    date_of_birth: payload.dob?.trim() || null,
    primary_phone: payload.clientPhone?.trim() || null,
    secondary_phone: payload.clientPhone2?.trim() || null,
    gender: payload.gender?.trim() || null,
    ethnicity: payload.ethnicity?.trim() || null,
    disability_history: payload.disability?.trim() || null,
    meeting_preference: payload.meetingOption?.trim() || null,
    counselor_availability: payload.counselorAvailability?.trim() || null,
    home_address_line1: addr.line1,
    home_city: addr.city,
    home_state: addr.state ?? (state === "GA" || state === "TN" ? state : null),
    home_zip: addr.zip,
  };

  let { error: patchErr } = await admin.from("clients").update(patch).eq("id", created.id);
  if (patchErr?.message.includes("prior_client_id")) {
    delete patch.prior_client_id;
    const retry = await admin.from("clients").update(patch).eq("id", created.id);
    patchErr = retry.error;
  }
  if (patchErr) return { error: patchErr.message };

  const { resolveParticipantForClient } = await import("./participants");
  await resolveParticipantForClient(admin, {
    clientId: created.id,
    fullName: clientName,
    dateOfBirth: payload.dob ?? null,
    contactEmail: payload.clientEmail ?? null,
  }).catch(() => undefined);

  await admin.from("client_intake_events").insert({
    client_id: created.id,
    actor_user_id: opts.actorUserId,
    event_type: "returning_client_referral_created",
    to_value: opts.priorClientId,
    metadata: {
      priorClientId: opts.priorClientId,
      source: opts.source ?? "begin_new_service",
      service: serviceName,
    },
  });

  await uploadReferralFile(admin, created.id, "authorizations", payload.authorizations ?? null);
  await uploadReferralFile(admin, created.id, "other", payload.otherDocs ?? null);

  return { ok: true, clientId: created.id };
}

/** Warn-only: other open referral-queue rows for the same participant. */
export async function findOpenIntakeForPriorClient(
  admin: SupabaseClient,
  priorClientId: string
): Promise<Array<{ id: string; full_name: string | null; intake_status: string }>> {
  const { data: prior } = await admin
    .from("clients")
    .select("participant_id")
    .eq("id", priorClientId)
    .maybeSingle();
  const participantId = (prior as { participant_id?: string | null })?.participant_id;
  if (!participantId) return [];

  const { data: rows } = await admin
    .from("clients")
    .select("id, full_name, intake_status")
    .eq("participant_id", participantId)
    .in("intake_status", ["new_referral", "pending_authorization"]);

  return (rows ?? []).filter((r) => r.id !== priorClientId) as Array<{
    id: string;
    full_name: string | null;
    intake_status: string;
  }>;
}

export async function setReferralPendingAuthorization(
  admin: SupabaseClient,
  opts: { clientId: string; actorUserId: string }
): Promise<{ ok: true } | { error: string }> {
  const nowIso = new Date().toISOString();
  const { data: before } = await admin
    .from("clients")
    .select("intake_status")
    .eq("id", opts.clientId)
    .maybeSingle();

  const { error } = await admin
    .from("clients")
    .update({
      intake_status: "pending_authorization",
      intake_status_changed_at: nowIso,
      last_activity_at: nowIso,
    })
    .eq("id", opts.clientId);

  if (error) return { error: error.message };

  await admin.from("client_intake_events").insert({
    client_id: opts.clientId,
    actor_user_id: opts.actorUserId,
    event_type: "pending_authorization",
    from_value: (before?.intake_status as string) ?? null,
    to_value: "pending_authorization",
  });

  return { ok: true };
}

export type ReferralClientInfoUpdate = {
  fullName?: string | null;
  dateOfBirth?: string | null;
  contactEmail?: string | null;
  primaryPhone?: string | null;
  secondaryPhone?: string | null;
  homeAddressLine1?: string | null;
  homeCity?: string | null;
  homeState?: string | null;
  homeZip?: string | null;
  gender?: string | null;
  ethnicity?: string | null;
  disabilityHistory?: string | null;
  workGoal?: string | null;
  meetingPreference?: string | null;
  counselorAvailability?: string | null;
  authorizationNumber?: string | null;
  referralState?: ReferralState | null;
  counselorName?: string | null;
  counselorEmail?: string | null;
  counselorPhone?: string | null;
  /** Website form service label (e.g. "Job Coaching") or full services.name */
  serviceLabel?: string | null;
  officeId?: string | null;
  counselorId?: string | null;
  /** Assigned supervisor user id (persisted on clients.supervisor_user_id). */
  supervisorUserId?: string | null;
  /** Assigns Employment Specialist via es_client_assignments (null clears). */
  esUserId?: string | null;
};

export async function updateReferralClientInfo(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    actorUserId: string;
    patch: ReferralClientInfoUpdate;
  }
): Promise<{ ok: true } | { error: string }> {
  const { data: existing, error: loadErr } = await admin
    .from("clients")
    .select("id, referral_state, current_service_id, counselor_id")
    .eq("id", opts.clientId)
    .maybeSingle();
  if (loadErr || !existing) {
    return { error: loadErr?.message ?? "Client not found" };
  }

  const p = opts.patch;
  const fullName = (p.fullName ?? "").trim();
  if (p.fullName !== undefined && !fullName) {
    return { error: "Client name is required" };
  }

  const referralState =
    p.referralState === "GA" || p.referralState === "TN"
      ? p.referralState
      : ((existing.referral_state as ReferralState | null) ?? null);

  const update: Record<string, unknown> = {
    last_activity_at: new Date().toISOString(),
  };

  if (p.fullName !== undefined) update.full_name = fullName;
  if (p.dateOfBirth !== undefined) update.date_of_birth = (p.dateOfBirth ?? "").trim() || null;
  if (p.contactEmail !== undefined) {
    const email = (p.contactEmail ?? "").trim().toLowerCase();
    update.contact_email = email || null;
  }
  if (p.primaryPhone !== undefined) update.primary_phone = (p.primaryPhone ?? "").trim() || null;
  if (p.secondaryPhone !== undefined) {
    update.secondary_phone = (p.secondaryPhone ?? "").trim() || null;
  }
  if (p.homeAddressLine1 !== undefined) {
    update.home_address_line1 = (p.homeAddressLine1 ?? "").trim() || null;
  }
  if (p.homeCity !== undefined) update.home_city = (p.homeCity ?? "").trim() || null;
  if (p.homeZip !== undefined) update.home_zip = (p.homeZip ?? "").trim() || null;
  if (p.homeState !== undefined) {
    const hs = (p.homeState ?? "").trim().toUpperCase();
    if (hs && hs !== "GA" && hs !== "TN") {
      return { error: "Home state must be GA or TN" };
    }
    update.home_state = hs || null;
  }
  if (p.gender !== undefined) update.gender = (p.gender ?? "").trim() || null;
  if (p.ethnicity !== undefined) update.ethnicity = (p.ethnicity ?? "").trim() || null;
  if (p.disabilityHistory !== undefined) {
    update.disability_history = (p.disabilityHistory ?? "").trim() || null;
  }
  if (p.workGoal !== undefined) {
    update.employment_goal_primary = (p.workGoal ?? "").trim() || null;
  }
  if (p.meetingPreference !== undefined) {
    update.meeting_preference = (p.meetingPreference ?? "").trim() || null;
  }
  if (p.counselorAvailability !== undefined) {
    update.counselor_availability = (p.counselorAvailability ?? "").trim() || null;
  }
  if (p.authorizationNumber !== undefined) {
    update.authorization_number = (p.authorizationNumber ?? "").trim() || null;
  }
  if (p.referralState !== undefined) {
    if (p.referralState !== "GA" && p.referralState !== "TN" && p.referralState !== null) {
      return { error: "Referral state must be GA or TN" };
    }
    update.referral_state = p.referralState;
  }

  if (p.supervisorUserId !== undefined) {
    const supervisorId = (p.supervisorUserId ?? "").trim();
    if (!supervisorId) {
      update.supervisor_user_id = null;
    } else {
      const { data: supervisor } = await admin
        .from("profiles")
        .select("id, role")
        .eq("id", supervisorId)
        .eq("role", "supervisor")
        .eq("is_active", true)
        .maybeSingle();
      if (!supervisor) {
        return { error: "Supervisor not found" };
      }
      update.supervisor_user_id = supervisorId;

      const { data: offices } = await admin
        .from("staff_office_assignments")
        .select("office_id")
        .eq("user_id", supervisorId)
        .limit(1);
      const supervisorOfficeId = (offices?.[0]?.office_id as string | undefined) ?? null;
      // Only auto-fill office when the caller did not send an officeId.
      if (p.officeId === undefined) {
        if (supervisorOfficeId) {
          update.office_id = supervisorOfficeId;
        } else {
          return { error: "That supervisor has no office assigned" };
        }
      } else if (!(p.officeId ?? "").trim() && !supervisorOfficeId) {
        return { error: "That supervisor has no office assigned" };
      } else if (!(p.officeId ?? "").trim() && supervisorOfficeId) {
        update.office_id = supervisorOfficeId;
      }
    }
  }

  if (p.officeId !== undefined) {
    const officeId = (p.officeId ?? "").trim();
    // Do not overwrite an office auto-filled from supervisor with an empty string
    // when both were sent and office was intentionally left blank for auto-fill.
    if (officeId || p.supervisorUserId === undefined) {
      update.office_id = officeId || null;
    }
  }

  if (p.counselorId !== undefined) {
    const counselorId = (p.counselorId ?? "").trim();
    update.counselor_id = counselorId || null;
    if (counselorId && p.officeId === undefined && p.supervisorUserId === undefined) {
      const counselorOfficeId = await resolveCounselorOfficeId(admin, counselorId);
      if (counselorOfficeId) {
        update.office_id = counselorOfficeId;
      }
    }
  }

  const counselorName = (p.counselorName ?? "").trim();
  const counselorEmail = (p.counselorEmail ?? "").trim().toLowerCase();
  if (counselorName || counselorEmail) {
    if (!counselorName || !counselorEmail || !counselorEmail.includes("@")) {
      return { error: "Counselor name and a valid email are required to update counselor" };
    }
    const counselor = await findOrCreateReferralCounselor(admin, {
      fullName: counselorName,
      email: counselorEmail,
      phone: p.counselorPhone ?? undefined,
    });
    if ("error" in counselor) return { error: counselor.error };
    update.counselor_id = counselor.counselorId;
    if (p.officeId === undefined && p.supervisorUserId === undefined) {
      const counselorOfficeId = await resolveCounselorOfficeId(admin, counselor.counselorId);
      if (counselorOfficeId) {
        update.office_id = counselorOfficeId;
      }
    }
  }

  if (p.serviceLabel !== undefined && (p.serviceLabel ?? "").trim()) {
    const label = (p.serviceLabel ?? "").trim();
    const stateForMap = (update.referral_state as ReferralState | null) ?? referralState;
    let serviceName =
      stateForMap === "GA" || stateForMap === "TN"
        ? mapReferralServiceName(stateForMap, label)
        : null;
    if (!serviceName) {
      // Allow passing the full services.name directly
      serviceName = label;
    }
    const serviceId = await resolveServiceId(admin, serviceName);
    if (!serviceId) {
      return { error: `Service not found: ${label}` };
    }
    update.current_service_id = serviceId;
  }

  const { error } = await admin.from("clients").update(update).eq("id", opts.clientId);
  if (error) {
    if (
      update.supervisor_user_id !== undefined &&
      /supervisor_user_id|does not exist|Could not find the '|schema cache/i.test(error.message)
    ) {
      return {
        error:
          "Supervisor assignment requires a database update. Ask an admin to run migration 20260827120000_clients_supervisor_user_id.",
      };
    }
    return { error: error.message };
  }

  if (p.esUserId !== undefined) {
    const esUserId = (p.esUserId ?? "").trim() || null;
    const directAssign = await loadDirectReferralAssignEnabled(admin);

    if (esUserId && directAssign) {
      const assigned = await assignReferralFieldSpecialist(admin, {
        clientId: opts.clientId,
        fieldSpecialistUserId: esUserId,
        actorUserId: opts.actorUserId,
      });
      if ("error" in assigned) return assigned;
    } else {
      if (esUserId) {
        const { data: esProfile } = await admin
          .from("profiles")
          .select("id, role, is_active")
          .eq("id", esUserId)
          .maybeSingle();
        if (!esProfile?.is_active) {
          return { error: "Employment Specialist not found" };
        }
        const esRole = String(esProfile.role ?? "").toLowerCase();
        if (esRole !== "es" && esRole !== "transition_specialist" && esRole !== "supervisor") {
          return {
            error: "Caseload can only be assigned to an ES, Transition Specialist, or supervisor.",
          };
        }
      }

      const { error: clearErr } = await admin
        .from("es_client_assignments")
        .delete()
        .eq("client_id", opts.clientId);
      if (clearErr) return { error: clearErr.message };

      if (esUserId) {
        const { error: assignErr } = await admin.from("es_client_assignments").insert({
          es_user_id: esUserId,
          client_id: opts.clientId,
        });
        if (assignErr) return { error: assignErr.message };
      }

      await admin
        .from("client_message_threads")
        .update({ current_es_user_id: esUserId })
        .eq("client_id", opts.clientId);
    }
  }

  await admin.from("client_intake_events").insert({
    client_id: opts.clientId,
    actor_user_id: opts.actorUserId,
    event_type: "referral_info_updated",
    metadata: { fields: Object.keys(update) },
  });

  return { ok: true };
}

export function isEasternWeekday(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
  }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  return wd !== "Sat" && wd !== "Sun";
}
