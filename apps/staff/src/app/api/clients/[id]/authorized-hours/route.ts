import {
  assertClientProfileAccess,
  jsonClientProfileError,
} from "@/lib/client-profile-auth";
import {
  canEditClientAuthorizedHoursFields,
  canViewClientAuthorizedHoursFields,
  parseAuthorizationEndDate,
  parseAuthorizedHours,
  serviceSupportsAuthorizedHoursFields,
} from "@wayfinder/supabase/referral-authorization-fields";
import {
  respondWithLoggedError,
  USER_FACING_FORBIDDEN,
  USER_FACING_NOT_FOUND,
} from "@wayfinder/supabase/error-log";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

const MISSING_COLUMN =
  /authorized_hours|authorization_end_date|does not exist|Could not find the '|schema cache/i;

async function loadClientServiceName(
  admin: Awaited<ReturnType<typeof assertClientProfileAccess>>["admin"],
  clientId: string
): Promise<
  | { clientId: string; serviceName: string | null; authorizedHours: number | null; authorizationEndDate: string | null }
  | { error: { message: string } }
  | { missingColumns: true }
  | null
> {
  const withHours = await admin
    .from("clients")
    .select("id, current_service_id, authorized_hours, authorization_end_date")
    .eq("id", clientId)
    .maybeSingle();

  if (withHours.error && MISSING_COLUMN.test(withHours.error.message)) {
    return { missingColumns: true };
  }
  if (withHours.error) {
    return { error: withHours.error };
  }
  if (!withHours.data) {
    return null;
  }

  let serviceName: string | null = null;
  const serviceId = withHours.data.current_service_id as string | null;
  if (serviceId) {
    const { data: service } = await admin.from("services").select("name").eq("id", serviceId).maybeSingle();
    serviceName = (service?.name as string | null) ?? null;
  }

  return {
    clientId: withHours.data.id as string,
    serviceName,
    authorizedHours:
      withHours.data.authorized_hours == null
        ? null
        : Number(withHours.data.authorized_hours as number),
    authorizationEndDate: (withHours.data.authorization_end_date as string | null) ?? null,
  };
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await assertClientProfileAccess(id);
    if (!canViewClientAuthorizedHoursFields(auth.role)) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const loaded = await loadClientServiceName(auth.admin, id);
    if (!loaded) {
      return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
    }
    if ("missingColumns" in loaded) {
      return NextResponse.json({
        authorizedHours: null,
        authorizationEndDate: null,
        serviceSupports: false,
        migrationRequired: true,
      });
    }
    if ("error" in loaded) {
      return respondWithLoggedError("staff", "api/clients/authorized-hours", loaded.error, {
        userId: auth.session.actorUserId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({
      authorizedHours: loaded.authorizedHours,
      authorizationEndDate: loaded.authorizationEndDate,
      serviceSupports: serviceSupportsAuthorizedHoursFields(loaded.serviceName),
      serviceName: loaded.serviceName,
      readOnly: auth.readOnly || !canEditClientAuthorizedHoursFields(auth.role),
    });
  } catch (error) {
    return await jsonClientProfileError(error, "api/clients/authorized-hours");
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const auth = await assertClientProfileAccess(id, true);
    if (!canEditClientAuthorizedHoursFields(auth.role)) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const loaded = await loadClientServiceName(auth.admin, id);
    if (!loaded) {
      return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
    }
    if ("missingColumns" in loaded) {
      return NextResponse.json(
        {
          error:
            "Authorized hours fields require a database update. Ask an admin to run migration 20261113120000_client_authorized_hours.",
        },
        { status: 503 }
      );
    }
    if ("error" in loaded) {
      return respondWithLoggedError("staff", "api/clients/authorized-hours", loaded.error, {
        userId: auth.session.actorUserId,
        userRole: auth.role,
      });
    }

    if (!serviceSupportsAuthorizedHoursFields(loaded.serviceName)) {
      return NextResponse.json(
        {
          error:
            "Authorized hours and end date apply only to Workplace Readiness Training, Individual Job Placement, or Job Coaching.",
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const hours = parseAuthorizedHours(body.authorizedHours);
    if (!hours.ok) {
      return NextResponse.json({ error: hours.error }, { status: 400 });
    }
    const endDate = parseAuthorizationEndDate(body.authorizationEndDate);
    if (!endDate.ok) {
      return NextResponse.json({ error: endDate.error }, { status: 400 });
    }

    const { error } = await auth.admin
      .from("clients")
      .update({
        authorized_hours: hours.value,
        authorization_end_date: endDate.value,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      if (MISSING_COLUMN.test(error.message)) {
        return NextResponse.json(
          {
            error:
              "Authorized hours fields require a database update. Ask an admin to run migration 20261113120000_client_authorized_hours.",
          },
          { status: 503 }
        );
      }
      return respondWithLoggedError("staff", "api/clients/authorized-hours", error, {
        userId: auth.session.actorUserId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return await jsonClientProfileError(error, "api/clients/authorized-hours");
  }
}
