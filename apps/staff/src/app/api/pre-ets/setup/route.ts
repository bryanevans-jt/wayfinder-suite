import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  deletePreEtsClassSetupEntry,
  listPreEtsClassSetup,
  upsertPreEtsClassSetupEntry,
} from "@wayfinder/supabase/pre-ets-class-setup";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/pre-ets/setup";
  const auth = await requirePreEtsApi("setup");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const admin = createServiceRoleClient();
    const rows = await listPreEtsClassSetup(admin, auth.settings.school_year);
    return NextResponse.json({ rows });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function POST(request: Request) {
  const route = "api/pre-ets/setup";
  const auth = await requirePreEtsApi("setup");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const body = (await request.json()) as {
      id?: string;
      regionalSupervisorUserId?: string | null;
      regionalSupervisorName?: string | null;
      schoolName?: string;
      schoolId?: string | null;
      districtNumber?: string | null;
      transitionSpecialistUserId?: string | null;
      transitionSpecialistName?: string | null;
      classDays?: string | null;
      classTime?: string | null;
      frequency?: string | null;
      serviceCode?: string | null;
      notes?: string | null;
    };

    if (!body.schoolName?.trim()) {
      return NextResponse.json({ error: "schoolName is required" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const row = await upsertPreEtsClassSetupEntry(
      admin,
      {
        id: body.id,
        regionalSupervisorUserId: body.regionalSupervisorUserId,
        regionalSupervisorName: body.regionalSupervisorName,
        schoolName: body.schoolName,
        schoolId: body.schoolId,
        districtNumber: body.districtNumber,
        transitionSpecialistUserId: body.transitionSpecialistUserId,
        transitionSpecialistName: body.transitionSpecialistName,
        classDays: body.classDays,
        classTime: body.classTime,
        frequency: body.frequency,
        serviceCode: body.serviceCode,
        notes: body.notes,
      },
      auth.userId
    );

    return NextResponse.json({ row });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function DELETE(request: Request) {
  const route = "api/pre-ets/setup";
  const auth = await requirePreEtsApi("setup");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    await deletePreEtsClassSetupEntry(admin, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
