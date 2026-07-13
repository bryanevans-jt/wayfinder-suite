import { loadHrRegistry } from "@/lib/hr-registry-data";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isAdminTierRole, isHrRole } from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  const route = "api/hr/clients-export";
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.effectiveRole ?? "";
  if (!isHrRole(role) && !isAdminTierRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const admin = createServiceRoleClient();
    const data = await loadHrRegistry(admin, {
      officeId: url.searchParams.get("office") ?? undefined,
      esUserId: url.searchParams.get("es") ?? undefined,
      clientId: url.searchParams.get("client") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      dateFrom: url.searchParams.get("from") ?? undefined,
      dateTo: url.searchParams.get("to") ?? undefined,
    });

    const lines = [
      "client,email,office,state,employment_specialist,service,stage,created_at,job_start_date",
      ...data.clients.map((c) =>
        [
          c.name,
          c.email ?? "",
          c.officeName ?? "",
          c.state ?? "",
          c.esNames,
          c.serviceName ?? "",
          c.stageTitle ?? "",
          c.createdAt ?? "",
          c.jobStartDate ?? "",
        ]
          .map((v) => csvEscape(String(v)))
          .join(",")
      ),
    ];

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="hr-clients.csv"',
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: session.effectiveUserId,
      userRole: role,
    });
  }
}
