import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { notifyPreEtsAuthRequestsSubmitted } from "@wayfinder/supabase/pre-ets-auth-request-notify";
import {
  canAccessPreEtsAccounts,
  canSupervisePreEts,
  loadPreEtsSettings,
  preEtsWorksheetTestingOverrideActive,
} from "@wayfinder/supabase/pre-ets-settings";
import {
  assertPlanningWorksheetDistrictAllowed,
  canUploadPreEtsWorksheets,
  usesPreEtsPlanningWorksheetUpload,
  worksheetUploadBypassesDistrictScope,
} from "@wayfinder/supabase/pre-ets-upload-scope";
import { isAccountantRole, isAdminRole, isSuperAdminRole } from "@wayfinder/supabase/roles";
import {
  commitWorksheetImport,
  type SkippedEmptyWorksheetGroup,
} from "@wayfinder/supabase/pre-ets-worksheet-import";
import { parseDistrictWorksheet, type ParsedDistrictWorksheet } from "@wayfinder/supabase/pre-ets-worksheet-parser";
import { worksheetFileToDistrictCsvTexts } from "@wayfinder/supabase/pre-ets-worksheet-workbook";
import { archiveWorksheetImportToDrive } from "@/lib/pre-ets-worksheet-archive";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export const maxDuration = 300;

type DistrictUploadResult =
  | {
      ok: true;
      sheetName: string;
      fileLabel: string;
      import: Record<string, unknown>;
      parsed: ParsedDistrictWorksheet;
      committed: boolean;
      districtId?: string;
      ytdWarnings?: unknown[];
      authMatchStats?: unknown;
      schoolGroupLabels?: string[];
      schoolNameWarnings?: unknown[];
      skippedEmptyGroups?: SkippedEmptyWorksheetGroup[];
      servingMetrics?: unknown;
      archivedToDrive?: boolean;
      archiveError?: string | null;
    }
  | { ok: false; sheetName: string; fileLabel: string; error: string; parsed?: ParsedDistrictWorksheet };

export async function POST(request: Request) {
  const route = "api/pre-ets/worksheets";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canUploadPreEtsWorksheets(auth.role, auth.settings)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isSupervisor = canSupervisePreEts(auth.role, auth.settings);
  const isAccounts = canAccessPreEtsAccounts(auth.role, auth.settings);

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A CSV or Excel file is required" }, { status: 400 });
    }

    let workbook;
    try {
      workbook = await worksheetFileToDistrictCsvTexts(file);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not read upload file" },
        { status: 400 }
      );
    }

    const settings = await loadPreEtsSettings(createServiceRoleClient());
    const admin = createServiceRoleClient();

    const accountantOnly =
      isAccountantRole(auth.role) &&
      !isAdminRole(auth.role) &&
      !isSupervisor;
    const testingOverride = preEtsWorksheetTestingOverrideActive(settings);
    const usesPlanning =
      isSuperAdminRole(auth.role) ||
      (testingOverride && isAdminRole(auth.role)) ||
      (!accountantOnly && usesPreEtsPlanningWorksheetUpload(auth.role));

    const phase = usesPlanning ? "planning" : "auth_match";
    const results: DistrictUploadResult[] = [];

    for (const sheet of workbook.sheets) {
      const fileLabel =
        workbook.sheets.length > 1
          ? `${file.name} · ${sheet.sheetName}`
          : file.name;

      const parsed = parseDistrictWorksheet(sheet.csvText, {
        notApprovedMarker: settings.not_approved_marker,
        groupAuthDigitCount: settings.group_auth_digit_count,
      });

      if (!parsed.districtNumber || !parsed.serviceMonth || !parsed.schoolYear) {
        results.push({
          ok: false,
          sheetName: sheet.sheetName,
          fileLabel,
          error: "Sheet must include district number, service month, and school year.",
          parsed,
        });
        continue;
      }

      if (usesPlanning && !worksheetUploadBypassesDistrictScope(auth.role, settings)) {
        const allowed = await assertPlanningWorksheetDistrictAllowed(
          admin,
          auth.userId,
          auth.role,
          parsed.districtNumber,
          parsed.schoolYear
        );
        if (!allowed.ok) {
          results.push({
            ok: false,
            sheetName: sheet.sheetName,
            fileLabel,
            error: allowed.error,
            parsed,
          });
          continue;
        }
      }

      const storedFileName =
        workbook.format === "csv"
          ? file.name
          : `${file.name.replace(/\.(xlsx|xls)$/i, "")}-${sheet.sheetName}.csv`;

      const { data, error } = await admin
        .from("pre_ets_worksheet_imports")
        .insert({
          service_month: parsed.serviceMonth,
          school_year: parsed.schoolYear,
          phase,
          status: "parsed",
          file_name: storedFileName,
          file_content: sheet.csvText,
          parse_result: parsed,
          created_by: auth.userId,
        })
        .select("id, service_month, school_year, phase, status, file_name, created_at")
        .single();

      if (error || !data) {
        results.push({
          ok: false,
          sheetName: sheet.sheetName,
          fileLabel,
          error: error?.message ?? "Could not save import",
          parsed,
        });
        continue;
      }

      const importId = data.id as string;

      if (phase === "planning") {
        const commit = await commitWorksheetImport(admin, importId, auth.userId, {
          allowDirectCommit: true,
        });
        if (!commit.ok) {
          results.push({
            ok: false,
            sheetName: sheet.sheetName,
            fileLabel,
            error: commit.error,
            parsed,
          });
          continue;
        }

        if (!testingOverride && commit.schoolGroupLabels.length > 0) {
          await notifyPreEtsAuthRequestsSubmitted(admin, {
            schoolGroupLabels: commit.schoolGroupLabels,
            serviceMonth: commit.serviceMonth,
            districtNumber: commit.districtNumber,
            importId,
          });
        }

        const archive = await archiveWorksheetImportToDrive(admin, importId);

        results.push({
          ok: true,
          sheetName: sheet.sheetName,
          fileLabel,
          import: data,
          parsed,
          committed: true,
          districtId: commit.districtId,
          ytdWarnings: commit.ytdWarnings,
          authMatchStats: commit.authMatchStats,
          schoolGroupLabels: commit.schoolGroupLabels,
          schoolNameWarnings: commit.schoolNameWarnings,
          skippedEmptyGroups: commit.skippedEmptyGroups,
          servingMetrics: commit.servingMetrics,
          archivedToDrive: archive.ok,
          archiveError: archive.ok ? null : archive.error,
        });
        continue;
      }

      results.push({
        ok: true,
        sheetName: sheet.sheetName,
        fileLabel,
        import: data,
        parsed,
        committed: false,
      });
    }

    const successes = results.filter((r) => r.ok) as Extract<DistrictUploadResult, { ok: true }>[];
    const failures = results.filter((r) => !r.ok);

    if (successes.length === 0) {
      return NextResponse.json(
        {
          error:
            failures[0]?.error ??
            "No district worksheets were imported. Check each tab has a billing header and district line.",
          multi: workbook.sheets.length > 1,
          districts: results,
        },
        { status: 400 }
      );
    }

    if (workbook.sheets.length === 1 && successes.length === 1) {
      const one = successes[0]!;
      return NextResponse.json({
        import: one.import,
        parsed: one.parsed,
        committed: one.committed,
        districtId: one.districtId,
        ytdWarnings: one.ytdWarnings,
        authMatchStats: one.authMatchStats,
        schoolGroupLabels: one.schoolGroupLabels,
        schoolNameWarnings: one.schoolNameWarnings,
        skippedEmptyGroups: one.skippedEmptyGroups,
        servingMetrics: one.servingMetrics,
        archivedToDrive: one.archivedToDrive,
        archiveError: one.archiveError,
        uploadFormat: workbook.format,
      });
    }

    return NextResponse.json({
      multi: true,
      uploadFormat: workbook.format,
      districts: results,
      committed: successes.every((s) => s.committed),
      importCount: successes.length,
      failedCount: failures.length,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function GET() {
  const route = "api/pre-ets/worksheets";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canUploadPreEtsWorksheets(auth.role, auth.settings)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isSupervisor = canSupervisePreEts(auth.role, auth.settings);
  const isAccounts = canAccessPreEtsAccounts(auth.role, auth.settings);
  const accountantOnly =
    isAccountantRole(auth.role) && !isAdminRole(auth.role) && !isSupervisor;

  try {
    const admin = createServiceRoleClient();
    let query = admin
      .from("pre_ets_worksheet_imports")
      .select(
        "id, service_month, school_year, phase, status, file_name, drive_file_name, archived_at, created_at, committed_at, created_by, parse_result"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (!accountantOnly && !isAccounts && isSupervisor) {
      query = query.eq("created_by", auth.userId);
    }

    const { data, error } = await query;

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    const planningUploader =
      isSuperAdminRole(auth.role) ||
      (!accountantOnly && usesPreEtsPlanningWorksheetUpload(auth.role));

    return NextResponse.json({
      imports: data ?? [],
      role: planningUploader ? "supervisor" : "accounts",
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
