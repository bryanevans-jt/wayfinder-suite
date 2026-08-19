import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPreEtsSettings } from "./pre-ets-settings";
import type { ParsedDistrictWorksheet, ParsedWorksheetGroup } from "./pre-ets-worksheet-parser";
import {
  assertPlanningCommittedForAuthMatch,
  countPendingAuthorizationsForDistrictMonth,
  findProgramGroupId,
  resolveAuthorizationForWorksheetRow,
  type AuthMatchStats,
} from "./pre-ets-worksheet-auth-match";

export type WorksheetImportPhase = "planning" | "auth_match";

export type PreEtsYtdWarning = {
  participantId: string;
  fullName: string;
  currentYtd: number;
  unitsAdding: number;
  threshold: number;
};

export type CommitWorksheetImportResult =
  | {
      ok: true;
      districtId: string;
      ytdWarnings: PreEtsYtdWarning[];
      authMatchStats?: AuthMatchStats;
    }
  | { ok: false; error: string };

async function upsertProgramGroup(
  admin: SupabaseClient,
  input: {
    phase: WorksheetImportPhase;
    schoolId: string;
    officeId: string;
    importId: string;
    serviceMonth: string;
    group: ParsedWorksheetGroup;
  }
): Promise<string | null> {
  const existingId = await findProgramGroupId(
    admin,
    input.schoolId,
    input.serviceMonth,
    input.group.groupName
  );

  if (existingId) {
    if (input.phase === "auth_match") {
      await admin
        .from("pre_ets_program_groups")
        .update({
          worksheet_import_id: input.importId,
          header_raw: input.group.headerRaw,
          frequency: input.group.frequency,
          instructor_name: input.group.instructorName,
          class_time: input.group.classTime,
          service_code: input.group.serviceCode,
          service_label: input.group.serviceLabel,
        })
        .eq("id", existingId);
    }
    return existingId;
  }

  const { data: programGroup, error: pgErr } = await admin
    .from("pre_ets_program_groups")
    .insert({
      school_id: input.schoolId,
      gvra_office_id: input.officeId,
      worksheet_import_id: input.importId,
      service_month: input.serviceMonth,
      header_raw: input.group.headerRaw,
      group_name: input.group.groupName,
      frequency: input.group.frequency,
      instructor_name: input.group.instructorName,
      class_time: input.group.classTime,
      service_code: input.group.serviceCode,
      service_label: input.group.serviceLabel,
    })
    .select("id")
    .single();

  if (pgErr || !programGroup) return null;
  return programGroup.id as string;
}

export type WorksheetImportActionResult = { ok: true } | { ok: false; error: string };

type WorksheetParseMeta = {
  rejectionReason?: string;
  rejectedAt?: string;
  rejectedBy?: string;
};

function parseMetaFromResult(parseResult: unknown): WorksheetParseMeta | null {
  if (!parseResult || typeof parseResult !== "object") return null;
  const meta = (parseResult as Record<string, unknown>)._meta;
  if (!meta || typeof meta !== "object") return null;
  return meta as WorksheetParseMeta;
}

export async function approveWorksheetImport(
  admin: SupabaseClient,
  importId: string,
  userId: string
): Promise<WorksheetImportActionResult> {
  const { data: imp, error } = await admin
    .from("pre_ets_worksheet_imports")
    .select("id, status, parse_result")
    .eq("id", importId)
    .maybeSingle();

  if (error || !imp) {
    return { ok: false, error: error?.message ?? "Import not found" };
  }
  if (imp.status === "committed") {
    return { ok: false, error: "Import already committed" };
  }
  if (imp.status === "rejected") {
    return { ok: false, error: "Import was rejected — upload a new file" };
  }

  const parsed = imp.parse_result as Record<string, unknown>;
  const { _meta: _removed, ...worksheetData } = parsed;

  await admin
    .from("pre_ets_worksheet_imports")
    .update({
      status: "approved",
      approved_by: userId,
      parse_result: worksheetData,
    })
    .eq("id", importId);

  return { ok: true };
}

export async function rejectWorksheetImport(
  admin: SupabaseClient,
  importId: string,
  userId: string,
  reason: string
): Promise<WorksheetImportActionResult> {
  const trimmed = reason.trim();
  if (!trimmed) {
    return { ok: false, error: "Rejection reason is required" };
  }

  const { data: imp, error } = await admin
    .from("pre_ets_worksheet_imports")
    .select("id, status, parse_result")
    .eq("id", importId)
    .maybeSingle();

  if (error || !imp) {
    return { ok: false, error: error?.message ?? "Import not found" };
  }
  if (imp.status === "committed") {
    return { ok: false, error: "Cannot reject a committed import" };
  }

  const parsed = (imp.parse_result ?? {}) as Record<string, unknown>;

  await admin
    .from("pre_ets_worksheet_imports")
    .update({
      status: "rejected",
      approved_by: null,
      parse_result: {
        ...parsed,
        _meta: {
          rejectionReason: trimmed,
          rejectedAt: new Date().toISOString(),
          rejectedBy: userId,
        },
      },
    })
    .eq("id", importId);

  return { ok: true };
}

export function worksheetRejectionReason(parseResult: unknown): string | null {
  return parseMetaFromResult(parseResult)?.rejectionReason ?? null;
}

export async function commitWorksheetImport(
  admin: SupabaseClient,
  importId: string,
  userId: string
): Promise<CommitWorksheetImportResult> {
  const { data: imp, error: impErr } = await admin
    .from("pre_ets_worksheet_imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (impErr || !imp) {
    return { ok: false, error: impErr?.message ?? "Import not found" };
  }

  if (imp.status === "committed") {
    return { ok: false, error: "Import already committed" };
  }
  if (imp.status === "rejected") {
    const reason = worksheetRejectionReason(imp.parse_result) ?? "Worksheet was rejected";
    return { ok: false, error: reason };
  }
  if (imp.status !== "approved") {
    return { ok: false, error: "Worksheet must be approved before commit" };
  }

  const parsed = imp.parse_result as ParsedDistrictWorksheet;
  if (!parsed?.districtNumber || !parsed.serviceMonth || !parsed.schoolYear) {
    return { ok: false, error: "Parsed worksheet missing district, month, or school year" };
  }

  const phase = (imp.phase as WorksheetImportPhase) ?? "planning";

  if (phase === "auth_match") {
    const planningCheck = await assertPlanningCommittedForAuthMatch(
      admin,
      parsed.districtNumber,
      parsed.schoolYear,
      parsed.serviceMonth
    );
    if (!planningCheck.ok) {
      return { ok: false, error: planningCheck.error };
    }
  }

  const settings = await loadPreEtsSettings(admin);
  const ytdThreshold = settings.ytd_unit_warning_threshold;
  const ytdWarnings: PreEtsYtdWarning[] = [];
  const warnedParticipants = new Set<string>();

  const authMatchStats: AuthMatchStats = {
    authorizationsMatched: 0,
    authorizationsCreated: 0,
    rosterEntriesUpdated: 0,
    unmatchedStudents: [],
    pendingAuthsRemaining: 0,
  };

  const { data: district, error: distErr } = await admin
    .from("pre_ets_districts")
    .upsert(
      {
        gvra_district_number: parsed.districtNumber,
        school_year: parsed.schoolYear,
        label: parsed.districtLine,
      },
      { onConflict: "gvra_district_number,school_year" }
    )
    .select("id")
    .single();

  if (distErr || !district) {
    return { ok: false, error: distErr?.message ?? "Could not upsert district" };
  }

  const districtId = district.id as string;

  await admin
    .from("pre_ets_worksheet_imports")
    .update({ district_id: districtId })
    .eq("id", importId);

  for (const office of parsed.offices) {
    const { data: officeRow, error: officeErr } = await admin
      .from("pre_ets_gvra_offices")
      .upsert(
        { district_id: districtId, name: office.name },
        { onConflict: "district_id,name" }
      )
      .select("id")
      .single();

    if (officeErr || !officeRow) continue;
    const officeId = officeRow.id as string;

    for (const group of office.groups) {
      const schoolName = group.groupName;
      const { data: school, error: schoolErr } = await admin
        .from("pre_ets_schools")
        .upsert(
          {
            district_id: districtId,
            gvra_office_id: officeId,
            name: schoolName,
          },
          { onConflict: "district_id,name" }
        )
        .select("id")
        .single();

      if (schoolErr || !school) continue;
      const schoolId = school.id as string;

      const programGroupId = await upsertProgramGroup(admin, {
        phase,
        schoolId,
        officeId,
        importId,
        serviceMonth: parsed.serviceMonth,
        group,
      });

      if (!programGroupId) continue;

      const groupStudents = group.students.filter((s) => !s.notApproved);
      const byAuth = new Map<string, typeof groupStudents>();

      for (const student of groupStudents) {
        const key =
          student.authType === "individual"
            ? `ind:${student.participantId}:${student.authNumber || "pending"}`
            : `grp:${student.authNumber || "pending"}`;
        const list = byAuth.get(key) ?? [];
        list.push(student);
        byAuth.set(key, list);
      }

      for (const [, students] of byAuth) {
        const first = students[0];
        if (!first) continue;

        const authType =
          first.authType === "individual"
            ? "individual"
            : first.authType === "group"
              ? "group"
              : "pending";

        const resolved = await resolveAuthorizationForWorksheetRow(admin, {
          phase,
          schoolId,
          serviceMonth: parsed.serviceMonth,
          schoolYear: parsed.schoolYear,
          programGroupId,
          group,
          students,
          first,
          authType,
        });

        if (!resolved) continue;

        const authId = resolved.authId;

        if (phase === "auth_match") {
          if (resolved.matchedPending) authMatchStats.authorizationsMatched++;
          if (resolved.createdNew) {
            authMatchStats.authorizationsCreated++;
            if (first.authNumber) {
              authMatchStats.unmatchedStudents.push({
                participantId: first.participantId,
                fullName: first.studentName,
                reason: "No pending authorization found — created new authorization",
              });
            }
          }
        }

        for (const row of students) {
          const { data: student, error: stuErr } = await admin
            .from("pre_ets_students")
            .upsert(
              {
                participant_id: row.participantId,
                full_name: row.studentName,
                school_year: parsed.schoolYear,
                primary_school_id: schoolId,
              },
              { onConflict: "participant_id,school_year" }
            )
            .select("id")
            .single();

          if (stuErr || !student) continue;
          const studentId = student.id as string;

          await admin.from("pre_ets_student_ytd_units").upsert(
            {
              student_id: studentId,
              school_year: parsed.schoolYear,
              billable_units: 0,
            },
            { onConflict: "student_id,school_year", ignoreDuplicates: true }
          );

          const { data: ytd } = await admin
            .from("pre_ets_student_ytd_units")
            .select("billable_units")
            .eq("student_id", studentId)
            .eq("school_year", parsed.schoolYear)
            .maybeSingle();

          const currentYtd = (ytd?.billable_units as number) ?? 0;
          if (
            currentYtd + row.units > ytdThreshold &&
            !warnedParticipants.has(row.participantId)
          ) {
            warnedParticipants.add(row.participantId);
            ytdWarnings.push({
              participantId: row.participantId,
              fullName: row.studentName,
              currentYtd,
              unitsAdding: row.units,
              threshold: ytdThreshold,
            });
          }

          let billedCents: number | null = null;
          if (row.billed) {
            const n = Number.parseFloat(row.billed.replace(/[^0-9.]/g, ""));
            if (Number.isFinite(n)) billedCents = Math.round(n * 100);
          }

          await admin.from("pre_ets_roster_entries").upsert(
            {
              authorization_id: authId,
              student_id: studentId,
              units_approved: row.units,
              class_time: row.classTime || group.classTime,
              invoice_number: row.invoiceNumber || null,
              billed_cents: billedCents,
              not_approved: false,
              list_order: row.listOrder,
            },
            { onConflict: "authorization_id,student_id" }
          );

          if (phase === "auth_match") {
            authMatchStats.rosterEntriesUpdated++;
          }
        }
      }
    }
  }

  if (phase === "auth_match") {
    authMatchStats.pendingAuthsRemaining = await countPendingAuthorizationsForDistrictMonth(
      admin,
      districtId,
      parsed.serviceMonth
    );
  }

  const commitWarnings = {
    ytdWarnings,
    ...(phase === "auth_match" ? { authMatchStats } : {}),
  };

  await admin
    .from("pre_ets_worksheet_imports")
    .update({
      status: "committed",
      committed_at: new Date().toISOString(),
      approved_by: userId,
      commit_warnings: commitWarnings,
    })
    .eq("id", importId);

  return {
    ok: true,
    districtId,
    ytdWarnings,
    ...(phase === "auth_match" ? { authMatchStats } : {}),
  };
}
