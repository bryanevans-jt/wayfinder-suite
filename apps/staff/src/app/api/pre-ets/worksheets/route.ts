import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { parseDistrictWorksheet } from "@wayfinder/supabase/pre-ets-worksheet-parser";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/pre-ets/worksheets/parse";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const form = await request.formData();
    const file = form.get("file");
    const phase = String(form.get("phase") ?? "planning");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
    }
    if (phase !== "planning" && phase !== "auth_match") {
      return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
    }

    const text = await file.text();
    const settings = await loadPreEtsSettings(createServiceRoleClient());
    const parsed = parseDistrictWorksheet(text, {
      notApprovedMarker: settings.not_approved_marker,
      groupAuthDigitCount: settings.group_auth_digit_count,
    });

    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("pre_ets_worksheet_imports")
      .insert({
        service_month: parsed.serviceMonth ?? new Date().toISOString().slice(0, 10),
        school_year: parsed.schoolYear ?? settings.school_year,
        phase,
        status: "parsed",
        file_name: file.name,
        parse_result: parsed,
        created_by: auth.userId,
      })
      .select("id, service_month, school_year, phase, status, file_name, created_at")
      .single();

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ import: data, parsed });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function GET() {
  const route = "api/pre-ets/worksheets";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("pre_ets_worksheet_imports")
      .select("id, service_month, school_year, phase, status, file_name, created_at, committed_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ imports: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
