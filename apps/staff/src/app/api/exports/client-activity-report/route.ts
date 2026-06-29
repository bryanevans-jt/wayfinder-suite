import { assertStaffExportSession } from "@/lib/export-access";
import { formatClientActivityReportText } from "@/lib/client-activity-report";
import { activityLogsToCsv, loadActivityLogs } from "@/lib/portal-data";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/exports/client-activity-report";
  const auth = await assertStaffExportSession(["es"]);
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
    const admin = createServiceRoleClient();
    const rows = await loadActivityLogs(
      admin,
      {
        esUserId: auth.user.id,
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
        "Employment Specialist";

      const { data: clientRow } = await admin
        .from("clients")
        .select("id, contact_email, user_id, profile_id")
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
          full_name: clientProfile?.full_name ?? null,
          contact_email: clientRow.contact_email as string | null,
          id: clientId,
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
    const filename = `wayfinder-activity-${clientId.slice(0, 8)}-${dateFrom}-to-${dateTo}.csv`;

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
