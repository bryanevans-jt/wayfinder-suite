import { assertStaffExportSession } from "@/lib/export-access";
import { formatClientActivityReportText } from "@/lib/client-activity-report";
import { requireStaffClientAccess } from "@/lib/app-session";
import { activityLogsToCsv, loadActivityLogs } from "@/lib/portal-data";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithLoggedError,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/exports/client-activity-report";
  const auth = await assertStaffExportSession(["es", "supervisor"]);
  if (auth.error) {
    return auth.error;
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("client");
  const dateFrom = url.searchParams.get("from") ?? undefined;
  const dateTo = url.searchParams.get("to") ?? undefined;
  const format = url.searchParams.get("format") ?? "csv";

  if (!clientId) {
    return NextResponse.json({ error: "client is required" }, { status: 400 });
  }
  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "from and to dates are required" }, { status: 400 });
  }

  const actor = { userId: auth.user.id, userRole: auth.role };

  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: "Please sign in again to continue." }, { status: 401 });
    }
    const allowed = await requireStaffClientAccess(session, clientId);
    if (!allowed) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const admin = createServiceRoleClient();
    const rows = await loadActivityLogs(
      admin,
      {
        // Supervisors need the full client timeline, not only rows where they are the ES.
        ...(auth.role === "es" ? { esUserId: auth.user.id } : {}),
        clientId,
        dateFrom,
        dateTo,
        limit: 5000,
      },
      undefined
    );

    if (format === "text") {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name, email")
        .eq("id", auth.user.id)
        .maybeSingle();

      const esName =
        (profile?.full_name as string | null)?.trim() ||
        (profile?.email as string | null) ||
        (auth.role === "supervisor" ? "Supervisor" : "Employment Specialist");

      const { data: clientRow } = await admin
        .from("clients")
        .select("id, contact_email, user_id, profile_id, full_name")
        .eq("id", clientId)
        .maybeSingle();

      let clientName = rows[0]?.client_name ?? "Client";
      if (clientRow) {
        const authId =
          (clientRow.user_id as string | null) ?? (clientRow.profile_id as string | null);
        const { data: clientProfile } = authId
          ? await admin.from("profiles").select("full_name").eq("id", authId).maybeSingle()
          : { data: null as { full_name: string | null } | null };

        const { clientDisplayName } = await import("@wayfinder/branding");
        clientName = clientDisplayName({
          full_name:
            (clientProfile?.full_name as string | null) ??
            (clientRow.full_name as string | null) ??
            null,
          contact_email: clientRow.contact_email as string | null,
        });
      }

      const text = formatClientActivityReportText({
        clientName,
        esName,
        dateFrom,
        dateTo,
        rows,
      });

      return new NextResponse(text, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const csv = activityLogsToCsv(rows);
    const safeName = (rows[0]?.client_name ?? "client")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const filename = `wayfinder-activity-${safeName || "client"}-${dateFrom}-to-${dateTo}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
