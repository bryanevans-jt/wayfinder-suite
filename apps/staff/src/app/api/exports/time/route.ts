import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { weekStartSunday } from "@wayfinder/supabase/es-time-tracking";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";
import {
  esTimeEntriesToCsv,
  loadEsTimeEntriesForWeek,
} from "@/lib/es-time-data";

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.effectiveRole;
  const canAccess =
    isEsRole(role) ||
    isSupervisorRole(role) ||
    role === "accountant" ||
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

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

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

  const entries = await loadEsTimeEntriesForWeek(admin, esUserId, weekStart);
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
}
