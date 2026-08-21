import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreEtsSettingsRow } from "./pre-ets-settings";
import { formatPreEtsRateDollars, resolvePreEtsServiceLabel } from "./pre-ets-settings";

export const PRE_ETS_INVOICE_MAX_SESSIONS = 5;

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

export type InvoicePacketSessionRow = {
  sessionId: string;
  sessionDate: string | null;
  /** Display date MM/DD/YYYY */
  sessionDateLabel: string;
  startTime: string | null;
  endTime: string | null;
  /** 9:00 AM style, or "" */
  startTimeLabel: string;
  endTimeLabel: string;
  groupName: string;
  serviceCode: string;
  serviceDescription: string;
  /** Present + signed students for this session */
  units: number;
  amountCents: number;
  amountLabel: string;
  /** Alphabetical full names of present students */
  presentNames: string[];
  instructorNames: string[];
  signedRosterDriveFileId: string | null;
  hasActivityReport: boolean;
};

export type InvoicePacketPdfData = {
  packetId: string;
  authorizationId: string;
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
  /** Unique primary + co-instructors across sessions */
  instructorNames: string;
  participants: InvoicePacketParticipant[];
  /** Flat attendance lines (legacy detail PDF) */
  sessionLines: InvoicePacketSessionLine[];
  /** Chronological completed sessions (max used in template: 5) */
  sessions: InvoicePacketSessionRow[];
  accountsSignatureData: string | null;
  accountsSignedDate: string | null;
};

export type InvoicePacketEditableOverrides = {
  instructorNames?: string;
  totalUnits?: number;
  totalAmountCents?: number;
  invoiceNumber?: string | null;
  serviceCode?: string;
  serviceLabel?: string | null;
  schoolName?: string;
  authType?: "group" | "individual";
  accountsSignatureData?: string | null;
  accountsSignedDate?: string | null;
  sessions?: Array<{
    sessionId: string;
    groupName?: string;
    serviceCode?: string;
    serviceDescription?: string;
    sessionDateLabel?: string;
    startTimeLabel?: string;
    endTimeLabel?: string;
    units?: number;
    amountCents?: number;
    presentNames?: string[];
  }>;
};

type AuthRow = {
  id?: string;
  auth_number: string | null;
  auth_type: string;
  service_code: string;
  service_label: string | null;
  service_month: string;
  program_group_id?: string | null;
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
  pre_ets_program_groups?:
    | { group_name: string | null }
    | { group_name: string | null }[]
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

/** Format YYYY-MM-DD → MM/DD/YYYY for invoice display. */
export function formatInvoiceDateLabel(isoDate: string | null | undefined): string {
  const raw = (isoDate ?? "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

/** Format DB time (`09:00:00` / `09:00`) → `9:00 AM`. */
export function formatInvoiceTimeLabel(time: string | null | undefined): string {
  const raw = (time ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  let hour = Number(match[1]);
  const minute = match[2];
  if (!Number.isFinite(hour)) return raw;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minute} ${suffix}`;
}

export function formatInvoiceAmountCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function yesNoCheckboxesForAuthType(authType: "group" | "individual"): string {
  const checked = "☑";
  const unchecked = "☐";
  if (authType === "individual") {
    return `Individual ${checked}  Group ${unchecked}`;
  }
  return `Individual ${unchecked}  Group ${checked}`;
}

function uniqueSortedNames(names: string[]): string[] {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export function applyInvoicePacketOverrides(
  data: InvoicePacketPdfData,
  overrides: InvoicePacketEditableOverrides | null | undefined
): InvoicePacketPdfData {
  if (!overrides) return data;
  const next: InvoicePacketPdfData = { ...data, sessions: data.sessions.map((s) => ({ ...s })) };

  if (overrides.instructorNames !== undefined) {
    next.instructorNames = overrides.instructorNames.trim();
  }
  if (overrides.totalUnits !== undefined && Number.isFinite(overrides.totalUnits)) {
    next.totalUnits = Math.max(0, overrides.totalUnits);
  }
  if (overrides.totalAmountCents !== undefined && Number.isFinite(overrides.totalAmountCents)) {
    next.totalAmountCents = Math.max(0, Math.round(overrides.totalAmountCents));
  }
  if (overrides.invoiceNumber !== undefined) {
    next.invoiceNumber = overrides.invoiceNumber;
  }
  if (overrides.serviceCode !== undefined) {
    next.serviceCode = overrides.serviceCode;
  }
  if (overrides.serviceLabel !== undefined) {
    next.serviceLabel = overrides.serviceLabel;
  }
  if (overrides.schoolName !== undefined) {
    next.schoolName = overrides.schoolName;
  }
  if (overrides.authType === "group" || overrides.authType === "individual") {
    next.authType = overrides.authType;
  }
  if (overrides.accountsSignatureData !== undefined) {
    next.accountsSignatureData = overrides.accountsSignatureData;
  }
  if (overrides.accountsSignedDate !== undefined) {
    next.accountsSignedDate = overrides.accountsSignedDate;
  }

  if (overrides.sessions?.length) {
    const byId = new Map(overrides.sessions.map((s) => [s.sessionId, s]));
    next.sessions = next.sessions.map((session) => {
      const patch = byId.get(session.sessionId);
      if (!patch) return session;
      const units =
        patch.units !== undefined && Number.isFinite(patch.units)
          ? Math.max(0, Math.trunc(patch.units))
          : session.units;
      const amountCents =
        patch.amountCents !== undefined && Number.isFinite(patch.amountCents)
          ? Math.max(0, Math.round(patch.amountCents))
          : Math.round(units * next.rateCents);
      return {
        ...session,
        groupName: patch.groupName ?? session.groupName,
        serviceCode: patch.serviceCode ?? session.serviceCode,
        serviceDescription: patch.serviceDescription ?? session.serviceDescription,
        sessionDateLabel: patch.sessionDateLabel ?? session.sessionDateLabel,
        startTimeLabel: patch.startTimeLabel ?? session.startTimeLabel,
        endTimeLabel: patch.endTimeLabel ?? session.endTimeLabel,
        units,
        amountCents,
        amountLabel: formatInvoiceAmountCents(amountCents),
        presentNames: patch.presentNames
          ? uniqueSortedNames(patch.presentNames)
          : session.presentNames,
      };
    });
  }

  return next;
}

export function buildInvoicePacketPlaceholders(
  data: InvoicePacketPdfData
): Record<string, string> {
  const placeholders: Record<string, string> = {
    ProviderName: data.providerName,
    RemitAddress: data.remitAddress,
    SchoolName: data.schoolName,
    AuthNumber: data.authNumber,
    AuthType: data.authType === "individual" ? "Individual" : "Group",
    AuthTypeCheckboxes: yesNoCheckboxesForAuthType(data.authType),
    AuthTypeIndividual: data.authType === "individual" ? "☑" : "☐",
    AuthTypeGroup: data.authType === "group" ? "☑" : "☐",
    InvoiceNumber: data.invoiceNumber ?? "",
    ServiceMonth: data.serviceMonth,
    ServiceCode: data.serviceCode,
    ServiceLabel: data.serviceLabel ?? "",
    RateDollars: formatPreEtsRateDollars(data.rateCents),
    TotalUnits: String(data.totalUnits),
    TotalHours: String(data.totalUnits),
    TotalAmount: formatInvoiceAmountCents(data.totalAmountCents),
    InstructorNames: data.instructorNames,
    Instructors: data.instructorNames,
    InstructorName: data.instructorNames,
    AccountsSignedDate: formatInvoiceDateLabel(data.accountsSignedDate),
    ProviderSignedDate: formatInvoiceDateLabel(data.accountsSignedDate),
    SessionParticipantLists: formatSessionParticipantLists(data.sessions),
  };

  for (let i = 0; i < PRE_ETS_INVOICE_MAX_SESSIONS; i++) {
    const n = i + 1;
    const session = data.sessions[i];
    placeholders[`SessionGroupName${n}`] = session?.groupName ?? "";
    placeholders[`SessionSchoolGroupName${n}`] = session?.groupName ?? "";
    placeholders[`SessionServiceCode${n}`] = session?.serviceCode ?? "";
    placeholders[`SessionServiceDescription${n}`] = session?.serviceDescription ?? "";
    placeholders[`SessionDate${n}`] = session?.sessionDateLabel ?? "";
    placeholders[`SessionDates${n}`] = session?.sessionDateLabel ?? "";
    placeholders[`SessionStartTime${n}`] = session?.startTimeLabel ?? "";
    placeholders[`SessionEndTime${n}`] = session?.endTimeLabel ?? "";
    placeholders[`SessionUnits${n}`] = session ? String(session.units) : "";
    placeholders[`SessionHours${n}`] = session ? String(session.units) : "";
    placeholders[`SessionAmount${n}`] = session?.amountLabel ?? "";
    placeholders[`SessionParticipants${n}`] = session
      ? formatOneSessionParticipantList(session)
      : "";
  }

  return placeholders;
}

function formatOneSessionParticipantList(session: InvoicePacketSessionRow): string {
  if (session.presentNames.length === 0) return "";
  const lines = session.presentNames.map((name, idx) => `${idx + 1}. ${name}`);
  return `${session.sessionDateLabel || "Session"} Participants:\n${lines.join("\n")}`;
}

export function formatSessionParticipantLists(sessions: InvoicePacketSessionRow[]): string {
  const blocks = sessions
    .filter((s) => s.presentNames.length > 0)
    .map((s) => {
      const body = formatOneSessionParticipantList(s);
      return `┌────────────────────────────────────────\n│ ${body.replace(/\n/g, "\n│ ")}\n└────────────────────────────────────────`;
    });
  return blocks.join("\n\n");
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
      "id, authorization_id, service_month, total_hours, total_amount_cents, provider_invoice_number, pre_ets_authorizations(id, auth_number, auth_type, service_code, service_label, service_month, program_group_id, pre_ets_schools(name, pre_ets_districts(gvra_district_number, label)), pre_ets_program_groups(group_name))"
    )
    .eq("id", packetId)
    .maybeSingle();

  if (!packet) return null;

  const auth = relationOne(packet.pre_ets_authorizations as AuthRow | AuthRow[] | null);
  if (!auth) return null;

  const school = relationOne(auth.pre_ets_schools);
  const district = relationOne(school?.pre_ets_districts ?? null);
  const programGroup = relationOne(auth.pre_ets_program_groups ?? null);
  const authorizationId = packet.authorization_id as string;
  const authType = auth.auth_type === "individual" ? "individual" : "group";
  const groupName = (programGroup?.group_name ?? "").trim() || school?.name || "";
  const serviceLabel = resolvePreEtsServiceLabel(
    auth.service_code,
    auth.service_label,
    settings
  );
  const rateCents = settings.default_rate_cents;

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

  const { data: sessionsRaw } = await admin
    .from("pre_ets_sessions")
    .select(
      "id, session_date, start_time, end_time, instructor_name, primary_instructor_user_id, co_instructor_user_id, signed_roster_drive_file_id, status"
    )
    .eq("authorization_id", authorizationId)
    .eq("status", "completed")
    .order("session_date", { ascending: true });

  const sessionsList = sessionsRaw ?? [];
  const sessionIds = sessionsList.map((s) => s.id as string);

  const profileIds = [
    ...new Set(
      sessionsList
        .flatMap((s) => [s.primary_instructor_user_id, s.co_instructor_user_id])
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const nameByProfileId = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", profileIds);
    for (const p of profiles ?? []) {
      const name = ((p.full_name as string | null) ?? "").trim();
      if (name) nameByProfileId.set(p.id as string, name);
    }
  }

  const { data: reports } = await admin
    .from("pre_ets_activity_reports")
    .select("session_id, status")
    .in(
      "session_id",
      sessionIds.length > 0 ? sessionIds : ["00000000-0000-0000-0000-000000000000"]
    );

  const reportBySession = new Map(
    (reports ?? []).map((r) => [r.session_id as string, r.status as string])
  );

  const { data: attendance } = await admin
    .from("pre_ets_session_attendance")
    .select("session_id, present, signed_on_roster, pre_ets_students(participant_id, full_name)")
    .in(
      "session_id",
      sessionIds.length > 0 ? sessionIds : ["00000000-0000-0000-0000-000000000000"]
    );

  const presentBySession = new Map<string, { participantId: string; fullName: string }[]>();
  const participantMap = new Map<string, InvoicePacketParticipant>();
  const sessionLines: InvoicePacketSessionLine[] = [];

  for (const row of attendance ?? []) {
    if (!row.present || !row.signed_on_roster) continue;
    const student = relationOne(
      row.pre_ets_students as
        | { participant_id: string; full_name: string }
        | { participant_id: string; full_name: string }[]
        | null
    );
    if (!student) continue;

    const sessionId = row.session_id as string;
    const list = presentBySession.get(sessionId) ?? [];
    list.push({
      participantId: student.participant_id,
      fullName: student.full_name,
    });
    presentBySession.set(sessionId, list);

    const sessionRow = sessionsList.find((s) => s.id === sessionId);
    sessionLines.push({
      sessionDate: (sessionRow?.session_date as string | null) ?? null,
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

  const allInstructorNames: string[] = [];
  const sessions: InvoicePacketSessionRow[] = sessionsList.map((s) => {
    const sessionId = s.id as string;
    const present = presentBySession.get(sessionId) ?? [];
    const presentNames = uniqueSortedNames(present.map((p) => p.fullName));
    const units = present.length;
    const amountCents = Math.round(units * rateCents);

    const instructors: string[] = [];
    const primaryId = s.primary_instructor_user_id as string | null;
    const coId = s.co_instructor_user_id as string | null;
    if (primaryId && nameByProfileId.get(primaryId)) {
      instructors.push(nameByProfileId.get(primaryId)!);
    }
    if (coId && nameByProfileId.get(coId)) {
      instructors.push(nameByProfileId.get(coId)!);
    }
    const fallback = ((s.instructor_name as string | null) ?? "").trim();
    if (instructors.length === 0 && fallback) instructors.push(fallback);
    allInstructorNames.push(...instructors);

    const reportStatus = reportBySession.get(sessionId);
    const hasActivityReport =
      reportStatus === "submitted" || reportStatus === "late_submitted";

    return {
      sessionId,
      sessionDate: (s.session_date as string | null) ?? null,
      sessionDateLabel: formatInvoiceDateLabel(s.session_date as string | null),
      startTime: (s.start_time as string | null) ?? null,
      endTime: (s.end_time as string | null) ?? null,
      startTimeLabel: formatInvoiceTimeLabel(s.start_time as string | null),
      endTimeLabel: formatInvoiceTimeLabel(s.end_time as string | null),
      groupName,
      serviceCode: auth.service_code,
      serviceDescription: serviceLabel ?? "",
      units,
      amountCents,
      amountLabel: formatInvoiceAmountCents(amountCents),
      presentNames,
      instructorNames: uniqueSortedNames(instructors),
      signedRosterDriveFileId: (s.signed_roster_drive_file_id as string | null) ?? null,
      hasActivityReport,
    };
  });

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
    authorizationId,
    authType,
    providerName: settings.provider_name,
    remitAddress: settings.remit_address,
    schoolName: school?.name ?? "",
    districtFolderName: formatPreEtsDistrictFolderName(district?.gvra_district_number),
    authNumber: auth.auth_number ?? "",
    invoiceNumber,
    serviceCode: auth.service_code,
    serviceLabel,
    serviceMonth: String(packet.service_month).slice(0, 7),
    rateCents,
    totalUnits: packet.total_hours as number,
    totalAmountCents: packet.total_amount_cents as number,
    instructorNames: uniqueSortedNames(allInstructorNames).join(", "),
    participants,
    sessionLines,
    sessions,
    accountsSignatureData: null,
    accountsSignedDate: null,
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
