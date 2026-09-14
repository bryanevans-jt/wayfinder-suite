import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { finalizePreEtsAuthorization } from "@wayfinder/supabase/pre-ets-authorization-finalize";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/authorizations/[id]/finalize";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      authNumber?: string;
      serviceCode?: string;
      serviceLabel?: string | null;
      roster?: Array<{
        participantId?: string;
        fullName?: string;
        unitsApproved?: number;
        listOrder?: number;
        classTime?: string | null;
      }>;
    };

    const admin = createServiceRoleClient();
    const result = await finalizePreEtsAuthorization(admin, {
      authorizationId: id,
      actorUserId: auth.userId,
      authNumber: body.authNumber ?? "",
      roster: (body.roster ?? []).map((row, index) => ({
        participantId: row.participantId ?? "",
        fullName: row.fullName ?? "",
        unitsApproved: Number(row.unitsApproved ?? 0),
        listOrder: row.listOrder ?? index + 1,
        classTime: row.classTime ?? null,
      })),
      serviceCode: body.serviceCode,
      serviceLabel: body.serviceLabel,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      authorizationId: result.authorizationId,
      ytdWarnings: result.ytdWarnings,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
