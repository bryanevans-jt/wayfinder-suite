import type { SupabaseClient } from "@supabase/supabase-js";
import { referralStageLabel } from "@wayfinder/supabase/referral-labels";

export type ReferralExportRow = {
  id: string;
  full_name: string | null;
  contact_email: string | null;
  intake_status: string;
  referral_state: string | null;
  referred_at: string | null;
  date_of_birth: string | null;
  primary_phone: string | null;
  secondary_phone: string | null;
  gender: string | null;
  ethnicity: string | null;
  disability_history: string | null;
  meeting_preference: string | null;
  counselor_availability: string | null;
  authorization_number: string | null;
  authorization_override_reason: string | null;
  employment_goal_primary: string | null;
  home_address_line1: string | null;
  home_city: string | null;
  home_state: string | null;
  home_zip: string | null;
  counselorName: string | null;
  counselorEmail: string | null;
  serviceName: string | null;
  stageName: string | null;
  stageLabel: string;
  documents: Array<{ kind: string; file_name: string }>;
};

const CLIENT_FIELDS =
  "id, full_name, contact_email, intake_status, referral_state, referred_at, date_of_birth, primary_phone, secondary_phone, gender, ethnicity, disability_history, meeting_preference, counselor_availability, authorization_number, authorization_override_reason, employment_goal_primary, home_address_line1, home_city, home_state, home_zip, current_service_id, current_stage_id, counselor_id";

function formatAddress(row: {
  home_address_line1: string | null;
  home_city: string | null;
  home_state: string | null;
  home_zip: string | null;
}): string {
  const parts = [
    row.home_address_line1,
    [row.home_city, row.home_state].filter(Boolean).join(", "),
    row.home_zip,
  ].filter((p) => (p ?? "").trim());
  return parts.join(" · ") || "";
}

export function referralAddressLine(row: ReferralExportRow): string {
  return formatAddress(row);
}

export async function loadReferralExportRows(
  admin: SupabaseClient,
  clientIds: string[]
): Promise<ReferralExportRow[]> {
  if (clientIds.length === 0) return [];

  const { data: rows, error } = await admin
    .from("clients")
    .select(CLIENT_FIELDS)
    .in("id", clientIds);

  if (error || !rows?.length) return [];

  const byId = new Map(rows.map((r) => [r.id as string, r]));
  const ordered = clientIds.map((id) => byId.get(id)).filter(Boolean) as typeof rows;

  const counselorIds = [...new Set(ordered.map((r) => r.counselor_id).filter(Boolean))] as string[];
  const serviceIds = [...new Set(ordered.map((r) => r.current_service_id).filter(Boolean))] as string[];
  const stageIds = [...new Set(ordered.map((r) => r.current_stage_id).filter(Boolean))] as string[];

  const [{ data: counselors }, { data: services }, { data: stages }, { data: docs }] =
    await Promise.all([
      counselorIds.length
        ? admin.from("counselors").select("id, full_name, contact_email").in("id", counselorIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string; contact_email: string | null }[] }),
      serviceIds.length
        ? admin.from("services").select("id, name").in("id", serviceIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      stageIds.length
        ? admin.from("service_milestones").select("id, name, title").in("id", stageIds)
        : Promise.resolve({
            data: [] as { id: string; name: string | null; title: string | null }[],
          }),
      admin
        .from("client_referral_documents")
        .select("client_id, kind, file_name")
        .in("client_id", clientIds),
    ]);

  const counselorMap = Object.fromEntries(
    (counselors ?? []).map((c) => [
      c.id,
      { name: c.full_name as string, email: (c.contact_email as string | null) ?? null },
    ])
  );
  const serviceMap = Object.fromEntries((services ?? []).map((s) => [s.id, s.name as string]));
  const stageMap = Object.fromEntries(
    (stages ?? []).map((s) => [
      s.id,
      ((s.title as string | null) || (s.name as string | null) || "").trim() || null,
    ])
  );
  const docsByClient = new Map<string, Array<{ kind: string; file_name: string }>>();
  for (const d of docs ?? []) {
    const cid = d.client_id as string;
    const list = docsByClient.get(cid) ?? [];
    list.push({ kind: d.kind as string, file_name: d.file_name as string });
    docsByClient.set(cid, list);
  }

  return ordered.map((row) => {
    const counselor = row.counselor_id
      ? counselorMap[row.counselor_id as string]
      : undefined;
    const stageName = row.current_stage_id
      ? stageMap[row.current_stage_id as string] ?? null
      : null;
    return {
      id: row.id as string,
      full_name: (row.full_name as string | null) ?? null,
      contact_email: (row.contact_email as string | null) ?? null,
      intake_status: row.intake_status as string,
      referral_state: (row.referral_state as string | null) ?? null,
      referred_at: (row.referred_at as string | null) ?? null,
      date_of_birth: (row.date_of_birth as string | null) ?? null,
      primary_phone: (row.primary_phone as string | null) ?? null,
      secondary_phone: (row.secondary_phone as string | null) ?? null,
      gender: (row.gender as string | null) ?? null,
      ethnicity: (row.ethnicity as string | null) ?? null,
      disability_history: (row.disability_history as string | null) ?? null,
      meeting_preference: (row.meeting_preference as string | null) ?? null,
      counselor_availability: (row.counselor_availability as string | null) ?? null,
      authorization_number: (row.authorization_number as string | null) ?? null,
      authorization_override_reason: (row.authorization_override_reason as string | null) ?? null,
      employment_goal_primary: (row.employment_goal_primary as string | null) ?? null,
      home_address_line1: (row.home_address_line1 as string | null) ?? null,
      home_city: (row.home_city as string | null) ?? null,
      home_state: (row.home_state as string | null) ?? null,
      home_zip: (row.home_zip as string | null) ?? null,
      counselorName: counselor?.name ?? null,
      counselorEmail: counselor?.email ?? null,
      serviceName: row.current_service_id
        ? serviceMap[row.current_service_id as string] ?? null
        : null,
      stageName,
      stageLabel: referralStageLabel({
        intakeStatus: row.intake_status as string,
        stageTitle: stageName,
      }),
      documents: docsByClient.get(row.id as string) ?? [],
    };
  });
}
