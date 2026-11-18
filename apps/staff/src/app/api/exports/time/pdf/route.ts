import {
  buildClientTimesheetPdf,
  buildClientTimesheetPdfZip,
  groupApprovedClientEntries,
} from "@/lib/timesheet-pdf";
import {
  calendarMonthBoundsFromKey,
  currentMonthKey,
  loadEsTimeEntriesForMonth,
  loadEsTimeEntriesForWeek,
  monthLabelFromKey,
} from "@/lib/es-time-data";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { weekEndSaturday, weekStartSunday } from "@wayfinder/supabase/es-time-tracking";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import path from "node:path";
import { NextResponse } from "next/server";
import { supervisorCanAccessEs } from "@/lib/supervisor-client-scope";

export const runtime = "nodejs";

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

async function assertTimesheetExportAccess(
  session: NonNullable<Awaited<ReturnType<typeof getAppSession>>>,
  esUserId: string
) {
  const role = session.effectiveRole;
  const canAccess =
    isFieldSpecialistRole(role) ||
    isSupervisorRole(role) ||
    role === "accountant" ||
    role === "hr" ||
    isAdminTierRole(role);

  if (!canAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (isFieldSpecialistRole(role) && esUserId !== session.effectiveUserId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();

  if (isSupervisorRole(role) && !isAdminTierRole(role)) {
    const allowed = await supervisorCanAccessEs(admin, session.effectiveUserId, esUserId);
    if (!allowed) {
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
  const monthParam = url.searchParams.get("month")?.trim() ?? "";
  const weekParam = url.searchParams.get("week");
  const useMonth = MONTH_KEY_RE.test(monthParam);
  const monthKey = useMonth ? monthParam : currentMonthKey();
  const weekStart = weekStartSunday(weekParam ?? new Date());
  const weekEnd = weekEndSaturday(weekStart);
  const monthBounds = calendarMonthBoundsFromKey(monthKey);
  const requestedEs = url.searchParams.get("es");
  const requestedClient = url.searchParams.get("client");
  let esUserId = session.effectiveUserId;

  if (requestedEs) {
    esUserId = requestedEs;
  } else if (!isFieldSpecialistRole(session.effectiveRole)) {
    return NextResponse.json({ error: "es query param required" }, { status: 400 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const adminOrResponse = await assertTimesheetExportAccess(session, esUserId);
    if (adminOrResponse instanceof NextResponse) {
      return adminOrResponse;
    }
    const admin = adminOrResponse;

    const entries = useMonth || !weekParam
      ? await loadEsTimeEntriesForMonth(admin, esUserId, monthKey)
      : await loadEsTimeEntriesForWeek(admin, esUserId, weekStart);
    const clientGroups = groupApprovedClientEntries(entries);

    if (clientGroups.length === 0) {
      return NextResponse.json(
        { error: useMonth || !weekParam ? "No client time entries for this month" : "No client time entries for this week" },
        { status: 404 }
      );
    }

    const { data: esProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", esUserId)
      .maybeSingle();

    const esName =
      (esProfile?.full_name as string | null)?.trim() || "Employment Specialist";

    const periodStart = useMonth || !weekParam ? monthBounds.start : weekStart;
    const periodEnd = useMonth || !weekParam ? monthBounds.end : weekEnd;
    const periodFileStem = useMonth || !weekParam ? monthKey : weekStart;
    const periodLabel =
      useMonth || !weekParam
        ? `Month: ${monthLabelFromKey(monthKey)}`
        : undefined;

    const shared = {
      esName,
      weekStart: periodStart,
      weekEnd: periodEnd,
      periodLabel,
      fileStem: periodFileStem,
      approvedAt: null as string | null,
      approvedByName: null as string | null,
      publicDir: path.join(process.cwd(), "public"),
    };

    if (requestedClient) {
      const group = clientGroups.find((g) => g.clientId === requestedClient);
      if (!group) {
        return NextResponse.json({ error: "No entries for this client" }, { status: 404 });
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
          "Content-Disposition": `attachment; filename="timesheet-${safeClient}-${periodFileStem}.pdf"`,
        },
      });
    }

    if (clientGroups.length === 1) {
      const group = clientGroups[0]!;
      const pdfBytes = await buildClientTimesheetPdf({
        ...shared,
        clientName: group.clientName,
        entries: group.entries,
      });
      const safeClient = group.clientName.replace(/[<>:"/\\|?*]/g, "").trim() || "client";
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="timesheet-${safeClient}-${periodFileStem}.pdf"`,
        },
      });
    }

    const zipBytes = await buildClientTimesheetPdfZip(clientGroups, shared);
    return new NextResponse(Buffer.from(zipBytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="timesheets-${periodFileStem}.zip"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
