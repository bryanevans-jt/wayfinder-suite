import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPreEtsSettings, resolvePreEtsWorksheetServiceFields } from "./pre-ets-settings";
import {
  parseDistrictWorksheet,
  type ParsedDistrictWorksheet,
  type ParsedWorksheetGroup,
} from "./pre-ets-worksheet-parser";
import { resetPreEtsBillingMonthForDistrict } from "./pre-ets-data-reset";
import { loadPreEtsServingMetrics, type PreEtsServingMetricsMonth } from "./pre-ets-serving-metrics";
import {
  linkPreEtsClassSetupToSchool,
  resolveWorksheetSchoolName,
  type SchoolNameResolutionWarning,
} from "./pre-ets-class-setup";
import {
  countPendingAuthorizationsForDistrictMonth,
  resolveAuthorizationForWorksheetRow,
  type AuthMatchStats,
} from "./pre-ets-worksheet-auth-match";
import { syncPreEtsSchoolAssignmentsFromSpreadsheet } from "./pre-ets-instructor-sync";
import { restorePreEtsProgramGroupFromWorksheetImport } from "./pre-ets-program-group-visibility";
import {
  applyWorksheetGroupMapping,
  findProgramGroupForWorksheetImport,
  loadWorksheetGroupMappings,
  normalizeWorksheetHeaderKey,
  resolveWorksheetGroupMapping,
} from "./pre-ets-worksheet-group-mapping";

export type PreEtsYtdWarning = {
  participantId: string;
  fullName: string;
  currentYtd: number;
  unitsAdding: number;
  threshold: number;
};

export type SkippedEmptyWorksheetGroup = {
  schoolName: string;
  groupName: string;
  headerRaw: string;
};

export type CommitWorksheetImportResult =
  | {
      ok: true;
      districtId: string;
      ytdWarnings: PreEtsYtdWarning[];
      authMatchStats: AuthMatchStats;
      schoolNameWarnings: SchoolNameResolutionWarning[];
      /** Parsed groups with no eligible students — no authorization/roster created. */
      skippedEmptyGroups: SkippedEmptyWorksheetGroup[];
      /** School/group names with roster activity in this commit (for Accounts notifications). */
      schoolGroupLabels: string[];
      serviceMonth: string;
      districtNumber: string;
      /** District-wide serving totals for this billing month after commit (PID students). */
      servingMetrics: PreEtsServingMetricsMonth | null;
    }
  | { ok: false; error: string };

export type { SchoolNameResolutionWarning } from "./pre-ets-class-setup";

export type CommitWorksheetImportOptions = {
  /** Supervisor planning upload: commit from `parsed` without a separate approve step. */
  allowDirectCommit?: boolean;
  /** Re-apply a committed import after re-parsing stored `file_content` (clears month data first). */
  allowRecommit?: boolean;
};

export type ReprocessCommittedWorksheetImportResult =
  | (CommitWorksheetImportResult & { ok: true; reparsedGroupCount: number; reparsedStudentCount: number })
  | { ok: false; error: string };

async function upsertProgramGroup(
  admin: SupabaseClient,
  input: {
    schoolId: string;
    officeId: string;
    importId: string;
    serviceMonth: string;
    group: ParsedWorksheetGroup;
    settings: Awaited<ReturnType<typeof loadPreEtsSettings>>;
  }
): Promise<string | null> {
  const { serviceCode, serviceLabel } = resolvePreEtsWorksheetServiceFields(
    input.group.serviceCode,
    input.group.serviceLabel,
    input.settings
  );
  const headerKey = normalizeWorksheetHeaderKey(input.group.headerRaw);
  const existingId = await findProgramGroupForWorksheetImport(admin, {
    schoolId: input.schoolId,
    serviceMonth: input.serviceMonth,
    group: input.group,
  });

  if (existingId) {
    await admin
      .from("pre_ets_program_groups")
      .update({
        worksheet_import_id: input.importId,
        header_raw: input.group.headerRaw,
        group_name: input.group.groupName,
        frequency: input.group.frequency,
        instructor_name: input.group.instructorName,
        class_time: input.group.classTime,
        service_code: serviceCode,
        service_label: serviceLabel,
        worksheet_header_key: headerKey || null,
      })
      .eq("id", existingId);
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
      worksheet_header_key: headerKey || null,
      group_name: input.group.groupName,
      frequency: input.group.frequency,
      instructor_name: input.group.instructorName,
      class_time: input.group.classTime,
      service_code: serviceCode,
      service_label: serviceLabel,
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
  userId: string,
  options?: CommitWorksheetImportOptions
): Promise<CommitWorksheetImportResult> {
  const { data: imp, error: impErr } = await admin
    .from("pre_ets_worksheet_imports")
    .select("*")
    .eq("id", importId)
    .maybeSingle();

  if (impErr || !imp) {
    return { ok: false, error: impErr?.message ?? "Import not found" };
  }

  const allowRecommit = options?.allowRecommit === true;
  if (imp.status === "committed" && !allowRecommit) {
    return { ok: false, error: "Import already committed" };
  }
  if (imp.status === "rejected") {
    const reason = worksheetRejectionReason(imp.parse_result) ?? "Worksheet was rejected";
    return { ok: false, error: reason };
  }
  const allowDirect = options?.allowDirectCommit === true || allowRecommit;
  if (!allowDirect && imp.status !== "approved") {
    return { ok: false, error: "Worksheet must be approved before commit" };
  }
  if (
    allowDirect &&
    !allowRecommit &&
    imp.status !== "parsed" &&
    imp.status !== "approved"
  ) {
    return { ok: false, error: "Worksheet cannot be committed in its current state" };
  }

  const parsed = imp.parse_result as ParsedDistrictWorksheet;
  if (!parsed?.districtNumber || !parsed.serviceMonth || !parsed.schoolYear) {
    return { ok: false, error: "Parsed worksheet missing district, month, or school year" };
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
    instructorSchoolsAssigned: 0,
    instructorNamesIgnored: 0,
    pendingAuthsRemaining: 0,
  };
  const schoolNameWarnings: SchoolNameResolutionWarning[] = [];
  const skippedEmptyGroups: SkippedEmptyWorksheetGroup[] = [];
  const schoolGroupLabels = new Set<string>();

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

  const groupMappings = await loadWorksheetGroupMappings(admin, {
    schoolYear: parsed.schoolYear,
    districtId,
  });

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
      const mapping = resolveWorksheetGroupMapping(groupMappings, group.headerRaw);
      if (mapping) {
        applyWorksheetGroupMapping(group, mapping);
      }

      const resolution = await resolveWorksheetSchoolName(admin, {
        districtId,
        schoolYear: parsed.schoolYear,
        districtNumber: parsed.districtNumber,
        worksheetSchoolName: group.schoolName,
      });

      if (resolution.warning) {
        schoolNameWarnings.push(resolution.warning);
      }

      let schoolName = resolution.resolvedName;
      let schoolId = mapping?.canonical_school_id ?? null;

      if (schoolId) {
        const { data: linkedSchool } = await admin
          .from("pre_ets_schools")
          .select("id, name")
          .eq("id", schoolId)
          .maybeSingle();
        if (linkedSchool?.id) {
          schoolName = linkedSchool.name as string;
        } else {
          schoolId = null;
        }
      }

      if (!schoolId) {
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
        schoolId = school.id as string;
      }

      const programGroupId = await upsertProgramGroup(admin, {
        schoolId,
        officeId,
        importId,
        serviceMonth: parsed.serviceMonth,
        group,
        settings,
      });

      if (!programGroupId) continue;

      const groupStudents = group.students.filter(
        (s) => !s.notApproved && s.participantId.trim().length > 0
      );
      if (groupStudents.length > 0) {
        await restorePreEtsProgramGroupFromWorksheetImport(admin, programGroupId);
      }

      await linkPreEtsClassSetupToSchool(admin, {
        schoolYear: parsed.schoolYear,
        districtNumber: parsed.districtNumber,
        schoolName,
        schoolId,
        programGroupId,
        classTime: group.classTime,
      });

      if (groupStudents.length === 0) {
        skippedEmptyGroups.push({
          schoolName: group.schoolName,
          groupName: group.groupName,
          headerRaw: group.headerRaw,
        });
        continue;
      }
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
          schoolId,
          serviceMonth: parsed.serviceMonth,
          schoolYear: parsed.schoolYear,
          programGroupId,
          group,
          students,
          first,
          authType,
          settings,
        });

        if (!resolved) continue;

        const authId = resolved.authId;

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
              class_time: row.classTime?.trim() || group.classTime?.trim() || null,
              invoice_number: row.invoiceNumber || null,
              billed_cents: billedCents,
              not_approved: false,
              list_order: row.listOrder,
            },
            { onConflict: "authorization_id,student_id" }
          );

          authMatchStats.rosterEntriesUpdated++;
        }

        if (!first.authNumber) {
          schoolGroupLabels.add(schoolName);
        }
      }
    }
  }

  authMatchStats.pendingAuthsRemaining = await countPendingAuthorizationsForDistrictMonth(
    admin,
    districtId,
    parsed.serviceMonth
  );

  const assignmentSync = await syncPreEtsSchoolAssignmentsFromSpreadsheet(admin, {
    serviceMonth: parsed.serviceMonth,
    districtId,
  });
  authMatchStats.instructorSchoolsAssigned = assignmentSync.schoolsUpdated;
  authMatchStats.instructorNamesIgnored = assignmentSync.namesIgnored;

  const servingSnapshot = await loadPreEtsServingMetrics(admin, {
    schoolYear: parsed.schoolYear,
    focusMonth: parsed.serviceMonth,
  });

  const commitWarnings = {
    ytdWarnings,
    authMatchStats,
    schoolNameWarnings,
    skippedEmptyGroups,
    servingMetrics: servingSnapshot.current,
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
    authMatchStats,
    schoolNameWarnings,
    skippedEmptyGroups,
    schoolGroupLabels: [...schoolGroupLabels],
    serviceMonth: parsed.serviceMonth,
    districtNumber: parsed.districtNumber,
    servingMetrics: servingSnapshot.current,
  };
}

/** Re-parse stored upload text and re-commit rosters (no new file upload). */
export async function reprocessCommittedWorksheetImport(
  admin: SupabaseClient,
  importId: string,
  userId: string
): Promise<ReprocessCommittedWorksheetImportResult> {
  const { data: imp, error: impErr } = await admin
    .from("pre_ets_worksheet_imports")
    .select("id, status, file_content, service_month, school_year, district_id, parse_result")
    .eq("id", importId)
    .maybeSingle();

  if (impErr || !imp) {
    return { ok: false, error: impErr?.message ?? "Import not found" };
  }
  if (imp.status !== "committed") {
    return { ok: false, error: "Only committed imports can be reprocessed from the stored file" };
  }
  const fileContent = typeof imp.file_content === "string" ? imp.file_content.trim() : "";
  if (!fileContent) {
    return {
      ok: false,
      error: "Original worksheet text is not stored for this import — upload the file again",
    };
  }

  const settings = await loadPreEtsSettings(admin);
  const parsed = parseDistrictWorksheet(fileContent, {
    notApprovedMarker: settings.not_approved_marker,
    groupAuthDigitCount: settings.group_auth_digit_count,
  });

  if (!parsed.districtNumber || !parsed.serviceMonth || !parsed.schoolYear) {
    return { ok: false, error: "Re-parse failed — district, month, or school year missing" };
  }

  const reset = await resetPreEtsBillingMonthForDistrict(admin, {
    districtNumber: parsed.districtNumber,
    schoolYear: parsed.schoolYear,
    serviceMonth: parsed.serviceMonth,
    clearWorksheetImports: false,
    clearGroupMappings: false,
    clearClassSetup: false,
  });
  if (!reset.ok) {
    return { ok: false, error: reset.error };
  }

  await admin
    .from("pre_ets_worksheet_imports")
    .update({
      parse_result: parsed,
      service_month: parsed.serviceMonth,
      school_year: parsed.schoolYear,
    })
    .eq("id", importId);

  const commit = await commitWorksheetImport(admin, importId, userId, {
    allowRecommit: true,
    allowDirectCommit: true,
  });
  if (!commit.ok) {
    return commit;
  }

  return {
    ...commit,
    reparsedGroupCount: parsed.stats.groupCount,
    reparsedStudentCount: parsed.stats.studentCount,
  };
}
