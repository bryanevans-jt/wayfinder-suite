import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { updatePreEtsAuthorizationAuthNumber } from "@wayfinder/supabase/pre-ets-authorization-auth-number";
import { insertPreEtsAuthorizationEvent } from "@wayfinder/supabase/pre-ets-authorization-events";
import { loadBlockedPreEtsServiceMonths } from "@wayfinder/supabase/pre-ets-field-release";
import { refreshPreEtsDraftPacketTotals } from "@wayfinder/supabase/pre-ets-invoice-packet";
import { updatePendingPreEtsRoster } from "@wayfinder/supabase/pre-ets-roster-update";
import {
  canEditPreEtsAuthorizationNumber,
  canEditPreEtsRosterAfterAuthorization,
} from "@wayfinder/supabase/pre-ets-settings";
import { isPreEtsAuthorizationVisibleToRole } from "@/lib/pre-ets-field-gate";
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
    const { data: authRow } = await admin
      .from("pre_ets_authorizations")
      .select(
        "auth_number, auth_type, field_released_at, service_code, service_label, service_month, pre_ets_schools(name), pre_ets_program_groups(group_name)"
      )
      .eq("id", id)
      .maybeSingle();

    const school = relationOne(
      authRow?.pre_ets_schools as { name: string } | { name: string }[] | null
    );
    const group = relationOne(
      authRow?.pre_ets_program_groups as { group_name: string } | { group_name: string }[] | null
    );

    const { data, error } = await admin
      .from("pre_ets_roster_entries")
      .select(
        "id, units_approved, list_order, class_time, pre_ets_students(participant_id, full_name)"
      )
      .eq("authorization_id", id)
      .eq("not_approved", false)
      .is("removed_at", null)
      .order("list_order", { ascending: true });

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    const blockedMonths = await loadBlockedPreEtsServiceMonths(admin);
    if (
      authRow &&
      !isPreEtsAuthorizationVisibleToRole(
        {
          auth_number: authRow.auth_number as string | null,
          auth_type: authRow.auth_type as string,
          field_released_at: authRow.field_released_at as string | null,
          service_month: authRow.service_month as string | null,
        },
        auth.role,
        auth.settings,
        blockedMonths
      )
    ) {
      return NextResponse.json(
        {
          error: auth.settings.worksheet_testing_override_enabled
            ? "This test roster is visible to Admin and Super Admin only until it is released to instructors."
            : "This roster is not available until it is released to instructors.",
        },
        { status: 403 }
      );
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

    return NextResponse.json({
      roster,
      authorization: authRow
        ? {
            authNumber: (authRow.auth_number as string | null) ?? null,
            authType: authRow.auth_type as string,
            serviceCode: (authRow.service_code as string) ?? "",
            serviceLabel: (authRow.service_label as string | null) ?? null,
            serviceMonth: (authRow.service_month as string) ?? null,
            schoolName: school?.name ?? null,
            groupName: group?.group_name ?? null,
          }
        : null,
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
  const route = "api/pre-ets/authorizations/[id]/roster";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;
  const allowAfterAuthorization = canEditPreEtsRosterAfterAuthorization(auth.role);
  const allowEditAuthorizationNumber = canEditPreEtsAuthorizationNumber(auth.role);

  try {
    const admin = createServiceRoleClient();
    const { data: authRow } = await admin
      .from("pre_ets_authorizations")
      .select("auth_number, auth_type")
      .eq("id", id)
      .maybeSingle();

    if (!authRow) {
      return NextResponse.json({ error: "Authorization not found." }, { status: 404 });
    }

    const hasAuthorizationNumber = Boolean((authRow.auth_number as string | null)?.trim());
    const isPending = authRow.auth_type === "pending";
    const wasFinalized = hasAuthorizationNumber || !isPending;
    if (wasFinalized && !allowAfterAuthorization) {
      return NextResponse.json(
        {
          error:
            "This roster already has an authorization number. Only Accounts Specialist, Admin, or Super Admin can add or remove students.",
        },
        { status: 403 }
      );
    }

    const body = (await request.json()) as {
      authNumber?: string;
      roster?: Array<{
        participantId?: string;
        fullName?: string;
        unitsApproved?: number;
        listOrder?: number;
        classTime?: string | null;
      }>;
    };

    const result = await updatePendingPreEtsRoster(admin, {
      authorizationId: id,
      allowAfterAuthorization,
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

    const rosterChanged =
      result.addedStudentIds.length > 0 || result.removedStudentIds.length > 0;
    if (rosterChanged) {
      await insertPreEtsAuthorizationEvent(admin, {
        authorizationId: id,
        actorUserId: auth.userId,
        eventKind: "roster_students_changed",
        metadata: {
          addedStudentIds: result.addedStudentIds,
          removedStudentIds: result.removedStudentIds,
          keptStudentCount: result.keptStudentIds.length,
          afterFinalization: wasFinalized,
        },
      });
    }

    if (body.authNumber !== undefined) {
      if (!allowEditAuthorizationNumber) {
        return NextResponse.json(
          {
            error:
              "Only Accounts Specialist, Admin, or Super Admin can change the authorization number (A&I).",
          },
          { status: 403 }
        );
      }
      const authNumberResult = await updatePreEtsAuthorizationAuthNumber(admin, {
        authorizationId: id,
        authNumber: body.authNumber,
      });
      if (!authNumberResult.ok) {
        return NextResponse.json({ error: authNumberResult.error }, { status: 400 });
      }
      if (authNumberResult.changed) {
        await insertPreEtsAuthorizationEvent(admin, {
          authorizationId: id,
          actorUserId: auth.userId,
          eventKind: "auth_number_changed",
          metadata: {
            previousAuthNumber: authNumberResult.previousAuthNumber ?? null,
            nextAuthNumber: body.authNumber.trim(),
            authType: authNumberResult.authType,
            afterFinalization: wasFinalized,
          },
        });
      }
    }

    // Recalculate draft packet units only — never reset ready/submitted/paid packets
    // or clear saved invoice numbers (avoids Generate draft packet side effects).
    if (wasFinalized) {
      await refreshPreEtsDraftPacketTotals(admin, {
        authorizationId: id,
        defaultRateCents: auth.settings.default_rate_cents,
        actorUserId: auth.userId,
      });
    }

    return NextResponse.json({ ok: true, ytdWarnings: result.ytdWarnings });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
