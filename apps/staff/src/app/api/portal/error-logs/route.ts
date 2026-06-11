import { assertPortalSession, jsonPortalError } from "@/lib/portal-auth";
import { roleDisplayName } from "@wayfinder/supabase/roles";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { admin } = await assertPortalSession("super_admin");
    const sp = request.nextUrl.searchParams;
    const code = sp.get("code")?.trim().toUpperCase();
    const app = sp.get("app")?.trim();
    const limit = Math.min(Math.max(Number(sp.get("limit") ?? "200"), 1), 500);

    let query = admin
      .from("system_error_logs")
      .select(
        "id, error_code, created_at, app, route, user_id, user_name, user_role, user_role_label, status_code, technical_message, stack_trace, metadata"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (code) {
      query = query.ilike("error_code", `%${code}%`);
    }
    if (app === "staff" || app === "client") {
      query = query.eq("app", app);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(error.message);
    }

    const logs = (data ?? []).map((row) => ({
      id: row.id as string,
      errorCode: row.error_code as string,
      createdAt: row.created_at as string,
      app: row.app as string,
      route: row.route as string,
      userId: (row.user_id as string | null) ?? null,
      userName: (row.user_name as string | null) ?? null,
      userRole: (row.user_role as string | null) ?? null,
      userRoleLabel:
        (row.user_role_label as string | null) ??
        roleDisplayName(row.user_role as string | null),
      statusCode: (row.status_code as number | null) ?? null,
      technicalMessage: row.technical_message as string,
      stackTrace: (row.stack_trace as string | null) ?? null,
      metadata: (row.metadata as Record<string, unknown> | null) ?? {},
    }));

    return Response.json({ logs });
  } catch (error) {
    return await jsonPortalError(error, "api/portal/error-logs");
  }
}
