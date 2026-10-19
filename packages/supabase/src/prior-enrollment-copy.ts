import type { SupabaseClient } from "@supabase/supabase-js";

/** Referral form fields copied from a prior enrollment (matches PublicReferralPayload). */
export type PriorReferralDraftPayload = {
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
};

export const PRIOR_ENROLLMENT_DEMOGRAPHICS_SELECT =
  "id, participant_id, full_name, contact_email, user_id, profile_id, counselor_id, date_of_birth, primary_phone, secondary_phone, gender, ethnicity, disability_history, employment_goal_primary, employment_goal_primary_other, employment_goal_secondary, employment_goal_secondary_other, meeting_preference, counselor_availability, home_address_line1, home_address_line2, home_city, home_state, home_zip";

export type PriorEnrollmentDemographics = {
  id: string;
  participant_id: string | null;
  full_name: string | null;
  contact_email: string | null;
  user_id: string | null;
  profile_id: string | null;
  counselor_id: string | null;
  date_of_birth: string | null;
  primary_phone: string | null;
  secondary_phone: string | null;
  gender: string | null;
  ethnicity: string | null;
  disability_history: string | null;
  employment_goal_primary: string | null;
  employment_goal_primary_other: string | null;
  employment_goal_secondary: string | null;
  employment_goal_secondary_other: string | null;
  meeting_preference: string | null;
  counselor_availability: string | null;
  home_address_line1: string | null;
  home_address_line2: string | null;
  home_city: string | null;
  home_state: string | null;
  home_zip: string | null;
};

function pickNonEmpty(...values: Array<string | null | undefined>): string | null {
  for (const v of values) {
    const t = (v ?? "").trim();
    if (t) return t;
  }
  return null;
}

export function mergePriorEnrollmentDemographics(
  rows: PriorEnrollmentDemographics[],
  preferredClientId: string
): PriorEnrollmentDemographics | null {
  if (rows.length === 0) return null;
  const preferred = rows.find((r) => r.id === preferredClientId) ?? rows[0];
  const ordered = [preferred, ...rows.filter((r) => r.id !== preferred.id)];

  const merged = { ...preferred };
  const keys = [
    "full_name",
    "contact_email",
    "date_of_birth",
    "primary_phone",
    "secondary_phone",
    "gender",
    "ethnicity",
    "disability_history",
    "employment_goal_primary",
    "employment_goal_primary_other",
    "employment_goal_secondary",
    "employment_goal_secondary_other",
    "meeting_preference",
    "counselor_availability",
    "home_address_line1",
    "home_address_line2",
    "home_city",
    "home_state",
    "home_zip",
    "counselor_id",
  ] as const;

  for (const key of keys) {
    merged[key] = pickNonEmpty(...ordered.map((r) => r[key])) as never;
  }
  return merged;
}

export function formatPriorClientAddress(row: PriorEnrollmentDemographics): string {
  const line1 = (row.home_address_line1 ?? "").trim();
  const line2 = (row.home_address_line2 ?? "").trim();
  const city = (row.home_city ?? "").trim();
  const state = (row.home_state ?? "").trim();
  const zip = (row.home_zip ?? "").trim();
  const cityStateZip = [city, state].filter(Boolean).join(", ") + (zip ? ` ${zip}` : "");
  return [line1, line2, cityStateZip.trim()].filter(Boolean).join(", ");
}

export function formatWorkGoalFromPrior(row: PriorEnrollmentDemographics): string {
  const parts: string[] = [];
  const primary = (row.employment_goal_primary ?? "").trim();
  const primaryOther = (row.employment_goal_primary_other ?? "").trim();
  const secondary = (row.employment_goal_secondary ?? "").trim();
  const secondaryOther = (row.employment_goal_secondary_other ?? "").trim();
  if (primary) parts.push(primaryOther && primary.toLowerCase() === "other" ? primaryOther : primary);
  else if (primaryOther) parts.push(primaryOther);
  if (secondary) {
    parts.push(
      secondaryOther && secondary.toLowerCase() === "other"
        ? `Secondary: ${secondaryOther}`
        : `Secondary: ${secondary}`
    );
  } else if (secondaryOther) {
    parts.push(`Secondary: ${secondaryOther}`);
  }
  return parts.join("\n");
}

export function referralFieldFromPrior(
  payloadVal: string | undefined,
  priorVal: string | null | undefined
): string | null {
  const fromPayload = (payloadVal ?? "").trim();
  if (fromPayload) return fromPayload;
  return pickNonEmpty(priorVal);
}

export async function loadMergedPriorEnrollmentDemographics(
  admin: SupabaseClient,
  priorClientId: string
): Promise<PriorEnrollmentDemographics | null> {
  const { data: prior, error } = await admin
    .from("clients")
    .select(PRIOR_ENROLLMENT_DEMOGRAPHICS_SELECT)
    .eq("id", priorClientId)
    .maybeSingle();
  if (error || !prior) return null;

  let rows = [prior as PriorEnrollmentDemographics];
  const participantId = (prior as { participant_id?: string | null }).participant_id;
  if (participantId) {
    const { data: siblings } = await admin
      .from("clients")
      .select(PRIOR_ENROLLMENT_DEMOGRAPHICS_SELECT)
      .eq("participant_id", participantId);
    if (siblings?.length) {
      rows = siblings as PriorEnrollmentDemographics[];
    }
  }

  const merged = mergePriorEnrollmentDemographics(rows, priorClientId);
  if (!merged) return null;

  const displayName = await resolvePriorClientDisplayName(admin, merged);
  if (displayName) {
    merged.full_name = displayName;
  }

  const contactEmail = await resolvePriorClientContactEmail(admin, merged);
  if (contactEmail) {
    merged.contact_email = contactEmail;
  }

  return merged;
}

async function resolvePriorClientDisplayName(
  admin: SupabaseClient,
  row: PriorEnrollmentDemographics
): Promise<string | null> {
  const fromClient = (row.full_name ?? "").trim();
  if (fromClient) return fromClient;
  const profileId = row.user_id ?? row.profile_id;
  if (!profileId) return null;
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", profileId)
    .maybeSingle();
  return pickNonEmpty(profile?.full_name as string | null);
}

async function resolvePriorClientContactEmail(
  admin: SupabaseClient,
  row: PriorEnrollmentDemographics
): Promise<string | null> {
  const fromClient = (row.contact_email ?? "").trim();
  if (fromClient) return fromClient.toLowerCase();
  const profileId = row.user_id ?? row.profile_id;
  if (!profileId) return null;
  try {
    const { data: authUser } = await admin.auth.admin.getUserById(profileId);
    return pickNonEmpty(authUser.user?.email)?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export async function loadCounselorPhoneForPriorReferral(
  admin: SupabaseClient,
  priorClientId: string
): Promise<string | null> {
  const { data: events } = await admin
    .from("client_intake_events")
    .select("metadata, created_at")
    .eq("client_id", priorClientId)
    .in("event_type", ["referral_submitted", "returning_client_referral_created", "referral_info_updated"])
    .order("created_at", { ascending: false })
    .limit(20);

  for (const ev of events ?? []) {
    const meta = (ev.metadata ?? {}) as Record<string, unknown>;
    const phone = pickNonEmpty(
      meta.counselorPhone as string | undefined,
      meta.counselor_phone as string | undefined
    );
    if (phone) return phone;
  }
  return null;
}

export function priorDemographicsToReferralDraft(
  prior: PriorEnrollmentDemographics,
  opts: {
    counselorName: string;
    counselorEmail: string;
    counselorPhone: string;
    serviceLabel: string;
    dobForInput: string;
  }
): PriorReferralDraftPayload {
  return {
    counselorName: opts.counselorName,
    counselorEmail: opts.counselorEmail,
    counselorPhone: opts.counselorPhone,
    service: opts.serviceLabel,
    clientName: (prior.full_name ?? "").trim(),
    dob: opts.dobForInput,
    clientPhone: (prior.primary_phone ?? "").trim(),
    clientPhone2: (prior.secondary_phone ?? "").trim(),
    clientAddress: formatPriorClientAddress(prior),
    clientEmail: (prior.contact_email ?? "").trim(),
    gender: (prior.gender ?? "").trim(),
    ethnicity: (prior.ethnicity ?? "").trim(),
    disability: (prior.disability_history ?? "").trim(),
    workGoal: formatWorkGoalFromPrior(prior),
    meetingOption: (prior.meeting_preference ?? "").trim(),
    counselorAvailability: (prior.counselor_availability ?? "").trim(),
  };
}

export function clientPatchDemographicsFromPrior(
  payload: PriorReferralDraftPayload,
  prior: PriorEnrollmentDemographics,
  addrFromPayload: { line1: string | null; city: string | null; state: string | null; zip: string | null }
): Record<string, unknown> {
  const usePriorAddress =
    !(addrFromPayload.line1 ?? "").trim() && (prior.home_address_line1 ?? "").trim();

  return {
    date_of_birth: referralFieldFromPrior(payload.dob, prior.date_of_birth),
    primary_phone: referralFieldFromPrior(payload.clientPhone, prior.primary_phone),
    secondary_phone: referralFieldFromPrior(payload.clientPhone2, prior.secondary_phone),
    gender: referralFieldFromPrior(payload.gender, prior.gender),
    ethnicity: referralFieldFromPrior(payload.ethnicity, prior.ethnicity),
    disability_history: referralFieldFromPrior(payload.disability, prior.disability_history),
    meeting_preference: referralFieldFromPrior(payload.meetingOption, prior.meeting_preference),
    counselor_availability: referralFieldFromPrior(
      payload.counselorAvailability,
      prior.counselor_availability
    ),
    employment_goal_primary: referralFieldFromPrior(payload.workGoal, prior.employment_goal_primary),
    employment_goal_primary_other: prior.employment_goal_primary_other,
    employment_goal_secondary: prior.employment_goal_secondary,
    employment_goal_secondary_other: prior.employment_goal_secondary_other,
    home_address_line1: usePriorAddress
      ? prior.home_address_line1
      : referralFieldFromPrior(addrFromPayload.line1 ?? undefined, prior.home_address_line1),
    home_address_line2: pickNonEmpty(prior.home_address_line2),
    home_city: usePriorAddress
      ? prior.home_city
      : referralFieldFromPrior(addrFromPayload.city ?? undefined, prior.home_city),
    home_state: usePriorAddress
      ? prior.home_state
      : referralFieldFromPrior(addrFromPayload.state ?? undefined, prior.home_state),
    home_zip: usePriorAddress
      ? prior.home_zip
      : referralFieldFromPrior(addrFromPayload.zip ?? undefined, prior.home_zip),
  };
}
