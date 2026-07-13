import {
  buildClientTimesheetPdf,
  buildClientTimesheetPdfZip,
  groupApprovedClientEntries,
} from "@/lib/timesheet-pdf";
import {
  loadEsTimeEntriesForWeek,
  loadWeekSubmission,
} from "@/lib/es-time-data";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { weekEndSaturday, weekStartSunday } from "@wayfinder/supabase/es-time-tracking";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function assertTimesheetExportAccess(
  session: NonNullable<Awaited<ReturnType<typeof getAppSession>>>,
  esUserId: string
) {
  const role = session.effectiveRole;
  const canAccess =
    isEsRole(role) ||
    isSupervisorRole(role) ||
    role === "accountant" ||
    role === "hr" ||
    isAdminTierRole(role);

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isEsRole(role) && esUserId !== session.effectiveUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();

  if (isSupervisorRole(role) && !isAdminTierRole(role)) {
    const { data: link } = await admin
      .from("supervisor_es_assignments")
      .select("es_user_id")
      .eq("supervisor_user_id", session.effectiveUserId)
      .eq("es_user_id", esUserId)
      .maybeSingle();
    if (!link) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return admin;
}

export async function GET(request: Request) {
  const route = "api/exports/time/pdf";
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const weekStart = weekStartSunday(url.searchParams.get("week") ?? new Date());
  const weekEnd = weekEndSaturday(weekStart);
  const requestedEs = url.searchParams.get("es");
  const requestedClient = url.searchParams.get("client");
  let esUserId = session.effectiveUserId;

  if (requestedEs) {
    esUserId = requestedEs;
  } else if (!isEsRole(session.effectiveRole)) {
    return NextResponse.json({ error: "es query param required" }, { status: 400 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const adminOrResponse = await assertTimesheetExportAccess(session, esUserId);
    if (adminOrResponse instanceof NextResponse) {
      return adminOrResponse;
    }
    const admin = adminOrResponse;

    const weekSubmission = await loadWeekSubmission(admin, esUserId, weekStart);
    if (!weekSubmission || weekSubmission.status !== "approved") {
      return NextResponse.json(
        { error: "PDF export is available after supervisor approval" },
        { status: 403 }
      );
    }

    const entries = await loadEsTimeEntriesForWeek(admin, esUserId, weekStart);
    const approvedGroups = groupApprovedClientEntries(entries);

    if (approvedGroups.length === 0) {
      return NextResponse.json(
        { error: "No approved client time entries for this week" },
        { status: 404 }
      );
    }

    const { data: esProfile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", esUserId)
      .maybeSingle();

    const esName =
      (esProfile?.full_name as string | null)?.trim() ||
      (esProfile?.email as string | null) ||
      "Employment Specialist";

    let approvedByName: string | null = null;
    const { data: weekRow } = await admin
      .from("es_time_week_submissions")
      .select("approved_by")
      .eq("id", weekSubmission.id)
      .maybeSingle();

    const approvedBy = (weekRow?.approved_by as string | null) ?? null;
    if (approvedBy) {
      const { data: approver } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", approvedBy)
        .maybeSingle();
      approvedByName =
        (approver?.full_name as string | null)?.trim() ||
        (approver?.email as string | null) ||
        null;
    }

    const shared = {
      esName,
      weekStart,
      weekEnd,
      approvedAt: weekSubmission.approved_at,
      approvedByName,
      publicDir: path.join(process.cwd(), "public"),
    };

    if (requestedClient) {
      const group = approvedGroups.find((g) => g.clientId === requestedClient);
      if (!group) {
        return NextResponse.json({ error: "No approved entries for this client" }, { status: 404 });
      }

      const pdfBytes = await buildClientTimesheetPdf({
        ...shared,
        clientName: group.clientName,
        entries: group.entries,
      });

      const safeClient = group.clientName.replace(/[<>:"/\\|?*]/g, "").trim() || "client";
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="timesheet-${safeClient}-${weekStart}.pdf"`,
        },
      });
    }

    if (approvedGroups.length === 1) {
      const group = approvedGroups[0]!;
      const pdfBytes = await buildClientTimesheetPdf({
        ...shared,
        clientName: group.clientName,
        entries: group.entries,
      });
      const safeClient = group.clientName.replace(/[<>:"/\\|?*]/g, "").trim() || "client";
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="timesheet-${safeClient}-${weekStart}.pdf"`,
        },
      });
    }

    const zipBytes = await buildClientTimesheetPdfZip(approvedGroups, shared);
    return new NextResponse(Buffer.from(zipBytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="timesheets-${weekStart}.zip"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
