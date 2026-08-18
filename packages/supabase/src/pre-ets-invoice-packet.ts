import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreEtsSettingsRow } from "./pre-ets-settings";

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
  providerName: string;
  remitAddress: string;
  schoolName: string;
  authNumber: string;
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
  service_code: string;
  service_label: string | null;
  service_month: string;
  pre_ets_schools: { name: string } | { name: string }[] | null;
};

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export function resolvePreEtsDrivePath(
  template: string,
  vars: {
    schoolYear: string;
    month: string;
    school: string;
    authNumber: string;
  }
): string {
  return template
    .replace(/\{SchoolYear\}/g, vars.schoolYear)
    .replace(/\{Month\}/g, vars.month)
    .replace(/\{School\}/g, vars.school)
    .replace(/\{AuthNumber\}/g, vars.authNumber)
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
}

export async function loadInvoicePacketPdfData(
  admin: SupabaseClient,
  packetId: string,
  settings: Pick<PreEtsSettingsRow, "provider_name" | "remit_address" | "default_rate_cents">
): Promise<InvoicePacketPdfData | null> {
  const { data: packet } = await admin
    .from("pre_ets_invoice_packets")
    .select(
      "id, authorization_id, service_month, total_hours, total_amount_cents, pre_ets_authorizations(auth_number, service_code, service_label, service_month, pre_ets_schools(name))"
    )
    .eq("id", packetId)
    .maybeSingle();

  if (!packet) return null;

  const auth = relationOne(packet.pre_ets_authorizations as AuthRow | AuthRow[] | null);
  if (!auth) return null;

  const school = relationOne(auth.pre_ets_schools);
  const authorizationId = packet.authorization_id as string;

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
    providerName: settings.provider_name,
    remitAddress: settings.remit_address,
    schoolName: school?.name ?? "",
    authNumber: auth.auth_number ?? "",
    serviceCode: auth.service_code,
    serviceLabel: auth.service_label,
    serviceMonth: String(packet.service_month).slice(0, 7),
    rateCents: settings.default_rate_cents,
    totalUnits: packet.total_hours as number,
    totalAmountCents: packet.total_amount_cents as number,
    participants,
    sessionLines,
  };
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
