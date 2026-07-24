import { clientDisplayName } from "@wayfinder/branding";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { minutesToDecimalHours } from "@wayfinder/supabase/es-time-tracking";
import { resolvePayPeriod, type PayrollSettingsRow } from "@wayfinder/supabase/payroll-period";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isHrRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadStaffNameById } from "@/lib/operations-data";
import { loadSupervisorScope } from "@/lib/supervisor-client-scope";
import { NextResponse } from "next/server";

function canExportBillable(role: string | null | undefined): boolean {
  return (
    isSupervisorRole(role) ||
    isAdminTierRole(role) ||
    isHrRole(role) ||
    role === "accountant"
  );
}

/** State billing export: billable minutes per client line (overlaps across clients allowed). */
export async function GET(request: Request) {
  const route = "api/exports/billable";
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || !canExportBillable(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = { userId: session.effectiveUserId, userRole: role };

  try {
    const admin = createServiceRoleClient();
    const { data: settingsRow } = await admin
      .from("org_payroll_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const settings: PayrollSettingsRow = {
      pay_period_frequency:
        (settingsRow?.pay_period_frequency as PayrollSettingsRow["pay_period_frequency"]) ??
        "biweekly",
      period_start_date:
        (settingsRow?.period_start_date as string) ?? new Date().toISOString().slice(0, 10),
      period_end_date: (settingsRow?.period_end_date as string | null) ?? null,
    };

    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const period =
      fromParam && toParam
        ? { start: fromParam, end: toParam, frequency: settings.pay_period_frequency }
        : resolvePayPeriod(settings);

    let query = admin
      .from("es_time_entries")
      .select(
        "es_user_id, client_id, service_date, duration_minutes, service_start_at, service_end_at, activity_type_id, service_activity_types(code, name)"
      )
      .eq("status", "approved")
      .gte("service_date", period.start)
      .lte("service_date", period.end)
      .not("client_id", "is", null);

    if (isSupervisorRole(role) && !isAdminTierRole(role)) {
      const scope = await loadSupervisorScope(admin, session.effectiveUserId);
      if (scope.esUserIds.length === 0) {
        return new NextResponse(
          "es_name,es_user_id,client_name,client_id,service_date,billable_minutes,billable_hours,activity_code,activity_name,start_time,end_time\n",
          {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="wayfinder-billable-by-client-${period.start}-${period.end}.csv"`,
            },
          }
        );
      }
      query = query.in("es_user_id", scope.esUserIds);
    }

    const { data: entries } = await query;

    const esIds = [...new Set((entries ?? []).map((e) => e.es_user_id as string))];
    const clientIds = [
      ...new Set(
        (entries ?? [])
          .map((e) => e.client_id as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const [{ data: clients }, esName] = await Promise.all([
      clientIds.length
        ? admin
            .from("clients")
            .select("id, contact_email, user_id, profile_id")
            .in("id", clientIds)
        : Promise.resolve({
            data: [] as {
              id: string;
              contact_email: string | null;
              user_id: string | null;
              profile_id: string | null;
            }[],
          }),
      loadStaffNameById(admin, esIds, "ES"),
    ]);

    const profileIds = [
      ...new Set(
        (clients ?? [])
          .map((c) => (c.user_id ?? c.profile_id) as string | null)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const { data: clientProfiles } = profileIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const clientProfileName = new Map(
      (clientProfiles ?? []).map((p) => [p.id as string, p.full_name as string | null])
    );
    const clientName = new Map(
      (clients ?? []).map((c) => {
        const pid = (c.user_id ?? c.profile_id) as string | null;
        return [
          c.id as string,
          clientDisplayName({
            full_name: pid ? clientProfileName.get(pid) ?? null : null,
            contact_email: c.contact_email as string | null,
            id: c.id as string,
          }),
        ];
      })
    );

    const header =
      "es_name,es_user_id,client_name,client_id,service_date,billable_minutes,billable_hours,activity_code,activity_name,start_time,end_time\n";
    const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = (entries ?? []).map((e) => {
      const types = e.service_activity_types as
        | { code: string; name: string }
        | { code: string; name: string }[]
        | null;
      const type = Array.isArray(types) ? types[0] : types;
      const name = esName.get(e.es_user_id as string) ?? "ES";
      const cid = e.client_id as string;
      return [
        escape(name),
        e.es_user_id,
        escape(clientName.get(cid) ?? "Client"),
        cid,
        e.service_date,
        e.duration_minutes,
        minutesToDecimalHours(e.duration_minutes as number),
        type?.code ?? "",
        escape(type?.name ?? ""),
        e.service_start_at ?? "",
        e.service_end_at ?? "",
      ].join(",");
    });

    const csv = header + lines.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wayfinder-billable-by-client-${period.start}-${period.end}.csv"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
