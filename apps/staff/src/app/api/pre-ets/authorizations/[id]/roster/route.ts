import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { updatePendingPreEtsRoster } from "@wayfinder/supabase/pre-ets-roster-update";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/authorizations/[id]/roster";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("pre_ets_roster_entries")
      .select(
        "id, units_approved, list_order, class_time, pre_ets_students(participant_id, full_name), pre_ets_authorizations(auth_number, auth_type)"
      )
      .eq("authorization_id", id)
      .eq("not_approved", false)
      .order("list_order", { ascending: true });

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    const roster = (data ?? []).map((row) => {
      const student = relationOne(
        row.pre_ets_students as
          | { participant_id: string; full_name: string }
          | { participant_id: string; full_name: string }[]
          | null
      );
      return {
        id: row.id,
        unitsApproved: row.units_approved,
        classTime: row.class_time as string | null,
        participantId: student?.participant_id ?? null,
        fullName: student?.full_name ?? null,
      };
    });

    return NextResponse.json({ roster });
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
  const route = "api/pre-ets/authorizations/[id]/roster";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      roster?: Array<{
        participantId?: string;
        fullName?: string;
        unitsApproved?: number;
        listOrder?: number;
        classTime?: string | null;
      }>;
    };

    const admin = createServiceRoleClient();
    const result = await updatePendingPreEtsRoster(admin, {
      authorizationId: id,
      roster: (body.roster ?? []).map((row, index) => ({
        participantId: row.participantId ?? "",
        fullName: row.fullName ?? "",
        unitsApproved: Number(row.unitsApproved ?? 0),
        listOrder: row.listOrder ?? index + 1,
        classTime: row.classTime ?? null,
      })),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, ytdWarnings: result.ytdWarnings });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
