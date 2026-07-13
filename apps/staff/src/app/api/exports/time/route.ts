import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { weekStartSunday } from "@wayfinder/supabase/es-time-tracking";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";
import {
  esTimeEntriesToCsv,
  loadEsTimeEntriesForWeek,
} from "@/lib/es-time-data";
import { esUserAllowedForSupervisor, loadSupervisorScope } from "@/lib/supervisor-client-scope";

export async function GET(request: Request) {
  const route = "api/exports/time";
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  const url = new URL(request.url);
  const weekStart = weekStartSunday(url.searchParams.get("week") ?? new Date());
  const requestedEs = url.searchParams.get("es");
  let esUserId = session.effectiveUserId;

  if (requestedEs) {
    if (isEsRole(role) && requestedEs !== session.effectiveUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    esUserId = requestedEs;
  } else if (!isEsRole(role)) {
    return NextResponse.json({ error: "es query param required" }, { status: 400 });
  }

  const actor = { userId: session.effectiveUserId, userRole: role };

  try {
    const admin = createServiceRoleClient();

    if (isSupervisorRole(role) && !isAdminTierRole(role) && role !== "hr" && role !== "accountant") {
      const scope = await loadSupervisorScope(admin, session.effectiveUserId);
      if (!esUserAllowedForSupervisor(scope, esUserId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    let entries = await loadEsTimeEntriesForWeek(admin, esUserId, weekStart);
    const clientFilter = url.searchParams.get("client")?.trim();
    if (clientFilter) {
      entries = entries.filter((e) => e.client_id === clientFilter);
    }
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", esUserId)
      .maybeSingle();

    const esName =
      (profile?.full_name as string | null)?.trim() ||
      (profile?.email as string | null) ||
      "ES";

    const csv = esTimeEntriesToCsv(entries, esName, weekStart);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wayfinder-timesheet-${weekStart}.csv"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
