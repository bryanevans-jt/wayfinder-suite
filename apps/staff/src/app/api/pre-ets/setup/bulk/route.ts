import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  applyPreEtsClassSetupAssignments,
  bulkImportPreEtsClassSetup,
  parseClassSetupCsv,
} from "@wayfinder/supabase/pre-ets-class-setup";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/pre-ets/setup/bulk";
  const auth = await requirePreEtsApi("setup");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const body = (await request.json()) as {
      csv?: string;
      rows?: Record<string, unknown>[];
      applyAssignments?: boolean;
    };

    const admin = createServiceRoleClient();
    const parsedRows = body.csv?.trim()
      ? parseClassSetupCsv(body.csv)
      : (body.rows ?? []).map((row) => ({
          regionalSupervisorName: String(row.regionalSupervisorName ?? row.supervisor ?? ""),
          schoolName: String(row.schoolName ?? row.school ?? ""),
          districtNumber: row.districtNumber ? String(row.districtNumber) : undefined,
          transitionSpecialistName: String(
            row.transitionSpecialistName ?? row.transitionSpecialist ?? row.instructor ?? ""
          ),
          classDays: row.classDays ? String(row.classDays) : undefined,
          classTime: row.classTime ? String(row.classTime) : undefined,
          frequency: row.frequency ? String(row.frequency) : undefined,
          serviceCode: row.serviceCode ? String(row.serviceCode) : undefined,
          notes: row.notes ? String(row.notes) : undefined,
        }));

    if (!parsedRows.length) {
      return NextResponse.json({ error: "No rows to import" }, { status: 400 });
    }

    const result = await bulkImportPreEtsClassSetup(admin, parsedRows, auth.userId);
    const applied = body.applyAssignments
      ? await applyPreEtsClassSetupAssignments(admin, auth.settings.school_year)
      : { applied: 0 };

    return NextResponse.json({ ...result, assignmentsApplied: applied.applied });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
