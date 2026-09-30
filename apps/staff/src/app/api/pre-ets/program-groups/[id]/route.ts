import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  canAccessPreEtsAccounts,
  canManagePreEtsSetup,
  canSupervisePreEts,
} from "@wayfinder/supabase/pre-ets-settings";
import { updateProgramGroupLabels } from "@wayfinder/supabase/pre-ets-worksheet-group-mapping";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

function canEditProgramGroupLabels(role: string, settings: Parameters<typeof canManagePreEtsSetup>[1]): boolean {
  return (
    canManagePreEtsSetup(role, settings) ||
    canSupervisePreEts(role, settings) ||
    canAccessPreEtsAccounts(role, settings)
  );
}

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/program-groups/[id]";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canEditProgramGroupLabels(auth.role, auth.settings)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("pre_ets_program_groups")
      .select(
        "id, header_raw, worksheet_header_key, group_name, instructor_name, service_month, pre_ets_schools(name, district_id, pre_ets_districts(school_year, gvra_district_number))"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const school = relationOne(
      data.pre_ets_schools as unknown as
        | {
            name: string;
            district_id: string;
            pre_ets_districts:
              | { school_year: string; gvra_district_number: string }
              | { school_year: string; gvra_district_number: string }[]
              | null;
          }
        | {
            name: string;
            district_id: string;
            pre_ets_districts:
              | { school_year: string; gvra_district_number: string }
              | { school_year: string; gvra_district_number: string }[]
              | null;
          }[]
        | null
    );
    const district = relationOne(school?.pre_ets_districts ?? null);

    return NextResponse.json({
      programGroup: {
        id: data.id,
        headerRaw: data.header_raw,
        worksheetHeaderKey: data.worksheet_header_key,
        schoolName: school?.name ?? "",
        groupName: data.group_name,
        instructorName: data.instructor_name,
        serviceMonth: data.service_month,
        districtNumber: district?.gvra_district_number ?? null,
        schoolYear: district?.school_year ?? auth.settings.school_year,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/program-groups/[id]";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  if (!canEditProgramGroupLabels(auth.role, auth.settings)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      schoolName?: string;
      groupName?: string;
      instructorName?: string | null;
      rememberForFutureImports?: boolean;
    };

    const admin = createServiceRoleClient();
    const result = await updateProgramGroupLabels(admin, {
      programGroupId: id,
      schoolName: body.schoolName ?? "",
      groupName: body.groupName ?? "",
      instructorName: body.instructorName ?? null,
      rememberForFutureImports: body.rememberForFutureImports !== false,
      actorUserId: auth.userId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
