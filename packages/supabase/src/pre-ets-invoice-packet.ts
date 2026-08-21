import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreEtsSettingsRow } from "./pre-ets-settings";
import { resolvePreEtsServiceLabel } from "./pre-ets-settings";

export type InvoicePacketParticipant = {
  participantId: string;
  fullName: string;
  units: number;
};

export type InvoicePacketSessionLine = {
  sessionDate: string | null;
  participantId: string;
  fullName: string;
};

export type InvoicePacketPdfData = {
  packetId: string;
  authType: "group" | "individual";
  providerName: string;
  remitAddress: string;
  schoolName: string;
  districtFolderName: string;
  authNumber: string;
  invoiceNumber: string | null;
  serviceCode: string;
  serviceLabel: string | null;
  serviceMonth: string;
  rateCents: number;
  totalUnits: number;
  totalAmountCents: number;
  participants: InvoicePacketParticipant[];
  sessionLines: InvoicePacketSessionLine[];
};

type AuthRow = {
  auth_number: string | null;
  auth_type: string;
  service_code: string;
  service_label: string | null;
  service_month: string;
  pre_ets_schools:
    | {
        name: string;
        pre_ets_districts:
          | { gvra_district_number: string | null; label: string | null }
          | { gvra_district_number: string | null; label: string | null }[]
          | null;
      }
    | {
        name: string;
        pre_ets_districts:
          | { gvra_district_number: string | null; label: string | null }
          | { gvra_district_number: string | null; label: string | null }[]
          | null;
      }[]
    | null;
};

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export function resolvePreEtsDrivePath(
  template: string,
  vars: {
    schoolYear: string;
    district: string;
    month: string;
    school: string;
    authNumber: string;
  }
): string {
  return template
    .replace(/\{SchoolYear\}/g, vars.schoolYear)
    .replace(/\{District\}/g, vars.district)
    .replace(/\{Month\}/g, vars.month)
    .replace(/\{School\}/g, vars.school)
    .replace(/\{AuthNumber\}/g, vars.authNumber)
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

/** Folder-safe district label from spreadsheet GVRA district number (e.g. "5" → "District 5"). */
export function formatPreEtsDistrictFolderName(
  districtNumber: string | null | undefined
): string {
  const raw = (districtNumber ?? "").trim();
  if (!raw) return "District";
  if (/^district\b/i.test(raw)) return raw;
  return `District ${raw}`;
}

export async function loadInvoicePacketPdfData(
  admin: SupabaseClient,
  packetId: string,
  settings: Pick<
    PreEtsSettingsRow,
    "provider_name" | "remit_address" | "default_rate_cents" | "service_codes"
  >
): Promise<InvoicePacketPdfData | null> {
  const { data: packet } = await admin
    .from("pre_ets_invoice_packets")
    .select(
      "id, authorization_id, service_month, total_hours, total_amount_cents, provider_invoice_number, pre_ets_authorizations(auth_number, auth_type, service_code, service_label, service_month, pre_ets_schools(name, pre_ets_districts(gvra_district_number, label)))"
    )
    .eq("id", packetId)
    .maybeSingle();

  if (!packet) return null;

  const auth = relationOne(packet.pre_ets_authorizations as AuthRow | AuthRow[] | null);
  if (!auth) return null;

  const school = relationOne(auth.pre_ets_schools);
  const district = relationOne(school?.pre_ets_districts ?? null);
  const authorizationId = packet.authorization_id as string;
  const authType = auth.auth_type === "individual" ? "individual" : "group";

  const { data: rosterEntry } = await admin
    .from("pre_ets_roster_entries")
    .select("invoice_number")
    .eq("authorization_id", authorizationId)
    .not("invoice_number", "is", null)
    .limit(1)
    .maybeSingle();

  const invoiceNumber =
    (packet.provider_invoice_number as string | null) ??
    (rosterEntry?.invoice_number as string | null) ??
    null;

  const { data: sessions } = await admin
    .from("pre_ets_sessions")
    .select("id, session_date")
    .eq("authorization_id", authorizationId)
    .eq("status", "completed");

  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  const sessionDateById = new Map(
    (sessions ?? []).map((s) => [s.id as string, s.session_date as string | null])
  );

  const { data: attendance } = await admin
    .from("pre_ets_session_attendance")
    .select("session_id, pre_ets_students(participant_id, full_name)")
    .in("session_id", sessionIds.length > 0 ? sessionIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("present", true)
    .eq("signed_on_roster", true);

  const participantMap = new Map<string, InvoicePacketParticipant>();
  const sessionLines: InvoicePacketSessionLine[] = [];

  for (const row of attendance ?? []) {
    const student = relationOne(
      row.pre_ets_students as
        | { participant_id: string; full_name: string }
        | { participant_id: string; full_name: string }[]
        | null
    );
    if (!student) continue;

    const sessionId = row.session_id as string;
    sessionLines.push({
      sessionDate: sessionDateById.get(sessionId) ?? null,
      participantId: student.participant_id,
      fullName: student.full_name,
    });

    const existing = participantMap.get(student.participant_id);
    if (existing) {
      existing.units += 1;
    } else {
      participantMap.set(student.participant_id, {
        participantId: student.participant_id,
        fullName: student.full_name,
        units: 1,
      });
    }
  }

  const participants = [...participantMap.values()].sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  sessionLines.sort((a, b) => {
    const da = a.sessionDate ?? "";
    const db = b.sessionDate ?? "";
    if (da !== db) return da.localeCompare(db);
    return a.fullName.localeCompare(b.fullName);
  });

  return {
    packetId,
    authType,
    providerName: settings.provider_name,
    remitAddress: settings.remit_address,
    schoolName: school?.name ?? "",
    districtFolderName: formatPreEtsDistrictFolderName(district?.gvra_district_number),
    authNumber: auth.auth_number ?? "",
    invoiceNumber,
    serviceCode: auth.service_code,
    serviceLabel: resolvePreEtsServiceLabel(auth.service_code, auth.service_label, settings),
    serviceMonth: String(packet.service_month).slice(0, 7),
    rateCents: settings.default_rate_cents,
    totalUnits: packet.total_hours as number,
    totalAmountCents: packet.total_amount_cents as number,
    participants,
    sessionLines,
  };
}

export async function countBillableAttendanceUnits(
  admin: SupabaseClient,
  authorizationId: string
): Promise<number> {
  const { data: sessions } = await admin
    .from("pre_ets_sessions")
    .select("id")
    .eq("authorization_id", authorizationId)
    .eq("status", "completed");

  const sessionIds = (sessions ?? []).map((s) => s.id as string);
  if (!sessionIds.length) return 0;

  const { data: attendance } = await admin
    .from("pre_ets_session_attendance")
    .select("id, present, signed_on_roster")
    .in("session_id", sessionIds);

  return (attendance ?? []).filter((a) => a.present && a.signed_on_roster).length;
}

export async function insertInvoicePacketEvent(
  admin: SupabaseClient,
  input: {
    packetId: string;
    actorUserId?: string | null;
    eventKind: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await admin.from("pre_ets_invoice_packet_events").insert({
    packet_id: input.packetId,
    actor_user_id: input.actorUserId ?? null,
    event_kind: input.eventKind,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    metadata: input.metadata ?? {},
  });
}
