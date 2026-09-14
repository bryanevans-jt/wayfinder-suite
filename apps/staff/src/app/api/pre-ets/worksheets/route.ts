import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { notifyPreEtsAuthRequestsSubmitted } from "@wayfinder/supabase/pre-ets-auth-request-notify";
import {
  canAccessPreEtsAccounts,
  canSupervisePreEts,
  loadPreEtsSettings,
} from "@wayfinder/supabase/pre-ets-settings";
import {
  assertPlanningWorksheetDistrictAllowed,
  usesPreEtsPlanningWorksheetUpload,
  worksheetUploadBypassesDistrictScope,
} from "@wayfinder/supabase/pre-ets-upload-scope";
import { isAccountantRole, isAdminRole } from "@wayfinder/supabase/roles";
import { commitWorksheetImport } from "@wayfinder/supabase/pre-ets-worksheet-import";
import { parseDistrictWorksheet } from "@wayfinder/supabase/pre-ets-worksheet-parser";
import { archiveWorksheetImportToDrive } from "@/lib/pre-ets-worksheet-archive";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/pre-ets/worksheets";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  const isSupervisor = canSupervisePreEts(auth.role, auth.settings);
  const isAccounts = canAccessPreEtsAccounts(auth.role, auth.settings);
  if (!isSupervisor && !isAccounts) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }

    const text = await file.text();
    const settings = await loadPreEtsSettings(createServiceRoleClient());
    const parsed = parseDistrictWorksheet(text, {
      notApprovedMarker: settings.not_approved_marker,
      groupAuthDigitCount: settings.group_auth_digit_count,
    });

    if (!parsed.districtNumber || !parsed.serviceMonth || !parsed.schoolYear) {
      return NextResponse.json(
        { error: "Worksheet must include district number, service month, and school year." },
        { status: 400 }
      );
    }

    const accountantOnly =
      isAccountantRole(auth.role) &&
      !isAdminRole(auth.role) &&
      !isSupervisor;
    const usesPlanning = !accountantOnly && usesPreEtsPlanningWorksheetUpload(auth.role);

    if (usesPlanning && !worksheetUploadBypassesDistrictScope(auth.role)) {
      const allowed = await assertPlanningWorksheetDistrictAllowed(
        createServiceRoleClient(),
        auth.userId,
        auth.role,
        parsed.districtNumber,
        parsed.schoolYear
      );
      if (!allowed.ok) {
        return NextResponse.json({ error: allowed.error }, { status: 403 });
      }
    }

    const phase = usesPlanning ? "planning" : "auth_match";
    const admin = createServiceRoleClient();

    const { data, error } = await admin
      .from("pre_ets_worksheet_imports")
      .insert({
        service_month: parsed.serviceMonth,
        school_year: parsed.schoolYear,
        phase,
        status: "parsed",
        file_name: file.name,
        file_content: text,
        parse_result: parsed,
        created_by: auth.userId,
      })
      .select("id, service_month, school_year, phase, status, file_name, created_at")
      .single();

    if (error || !data) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    const importId = data.id as string;

    if (phase === "planning") {
      const commit = await commitWorksheetImport(admin, importId, auth.userId, {
        allowDirectCommit: true,
      });
      if (!commit.ok) {
        return NextResponse.json({ error: commit.error }, { status: 400 });
      }

      if (commit.schoolGroupLabels.length > 0) {
        await notifyPreEtsAuthRequestsSubmitted(admin, {
          schoolGroupLabels: commit.schoolGroupLabels,
          serviceMonth: commit.serviceMonth,
          districtNumber: commit.districtNumber,
          importId,
        });
      }

      const archive = await archiveWorksheetImportToDrive(admin, importId);

      return NextResponse.json({
        import: data,
        parsed,
        committed: true,
        districtId: commit.districtId,
        ytdWarnings: commit.ytdWarnings,
        authMatchStats: commit.authMatchStats,
        schoolGroupLabels: commit.schoolGroupLabels,
        archivedToDrive: archive.ok,
        archiveError: archive.ok ? null : archive.error,
      });
    }

    return NextResponse.json({ import: data, parsed, committed: false });
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

  const isSupervisor = canSupervisePreEts(auth.role, auth.settings);
  const isAccounts = canAccessPreEtsAccounts(auth.role, auth.settings);
  if (!isSupervisor && !isAccounts) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

    return NextResponse.json({
      imports: data ?? [],
      role: accountantOnly ? "accounts" : "supervisor",
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
