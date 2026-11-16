import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { fetchAllPostgrestRows } from "@wayfinder/supabase/postgrest-fetch-all";
import { driveFileUrl } from "@/lib/formal-report-utils";
import { requireAppSession, requireStaffClientAccess } from "@/lib/app-session";
import { canOverseeFormalReportSubmissions } from "@wayfinder/supabase/roles";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { FORMAL_REPORT_LABELS as REPORT_LABELS } from "@/lib/formal-report-labels";
import {
  attributeFormalReportToService,
  type FormalReportEpisode,
  type FormalReportServiceRow,
} from "@/lib/formal-report-history";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * All submitted official reports for a client (every service episode), newest first.
 * Prior-service rows are labeled when the covering episode's service differs from
 * clients.current_service_id. Paginate past PostgREST's 1000-row default.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/clients/[id]/formal-reports";
  const { id: clientId } = await context.params;
  const session = await requireAppSession();
  const caseworkAccess = await requireStaffClientAccess(session, clientId);
  const oversight = canOverseeFormalReportSubmissions(session.effectiveRole);
  if (!caseworkAccess && !oversight) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const admin = createServiceRoleClient();

    const [submissions, { data: client }, episodes] = await Promise.all([
      fetchAllPostgrestRows<{
        id: string;
        report_type_slug: string;
        state: string;
        reporting_month: string | null;
        submitted_by_name: string | null;
        drive_file_id: string | null;
        drive_file_name: string | null;
        created_at: string;
      }>(
        admin,
        "formal_report_submissions",
        "id, report_type_slug, state, reporting_month, submitted_by_name, drive_file_id, drive_file_name, created_at",
        {
          order: { column: "created_at", ascending: false },
          applyFilters: (query) => query.eq("wayfinder_client_id", clientId),
        }
      ),
      admin
        .from("clients")
        .select("id, current_service_id")
        .eq("id", clientId)
        .maybeSingle(),
      fetchAllPostgrestRows<{
        id: string;
        service_id: string | null;
        started_at: string | null;
        ended_at: string | null;
      }>(
        admin,
        "service_episodes",
        "id, service_id, started_at, ended_at",
        {
          order: { column: "started_at", ascending: true },
          applyFilters: (query) => query.eq("client_id", clientId),
        }
      ),
    ]);

    const currentServiceId = (client?.current_service_id as string | null) ?? null;
    const clientEpisodes: FormalReportEpisode[] = episodes.map((ep) => ({
      id: ep.id,
      service_id: ep.service_id,
      started_at: ep.started_at,
      ended_at: ep.ended_at,
    }));

    const serviceIds = [
      ...new Set(
        [
          currentServiceId,
          ...clientEpisodes.map((ep) => ep.service_id),
        ].filter((id): id is string => Boolean(id))
      ),
    ];
    const servicesById = new Map<string, FormalReportServiceRow>();
    if (serviceIds.length > 0) {
      const { data: services } = await admin
        .from("services")
        .select("id, name, state")
        .in("id", serviceIds);
      for (const row of services ?? []) {
        servicesById.set(row.id as string, {
          id: row.id as string,
          name: (row.name as string) ?? "",
          state: (row.state as string | null) ?? null,
        });
      }
    }

    return NextResponse.json({
      submissions: submissions.map((row) => {
        const attribution = attributeFormalReportToService({
          reportingMonth: row.reporting_month,
          createdAt: row.created_at,
          clientEpisodes,
          currentServiceId,
          servicesById,
        });
        return {
          id: row.id,
          reportType: row.report_type_slug,
          reportLabel:
            REPORT_LABELS[row.report_type_slug as string] ?? row.report_type_slug,
          state: row.state,
          reportingMonth: row.reporting_month,
          submittedByName: row.submitted_by_name,
          driveFileName: row.drive_file_name,
          driveUrl: driveFileUrl(row.drive_file_id as string | null),
          createdAt: row.created_at,
          serviceId: attribution.serviceId,
          serviceName: attribution.serviceName,
          isPriorService: attribution.isPriorService,
        };
      }),
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
