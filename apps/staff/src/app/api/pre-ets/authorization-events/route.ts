import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

/** Read-only authorization change log for Accounts Specialist / Super Admin. */
export async function GET(request: Request) {
  const route = "api/pre-ets/authorization-events";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const authorizationId = url.searchParams.get("authorizationId")?.trim() || null;
  const limitRaw = Number(url.searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 50;

  try {
    const admin = createServiceRoleClient();
    let query = admin
      .from("pre_ets_authorization_events")
      .select(
        "id, authorization_id, actor_user_id, event_kind, metadata, created_at, profiles(full_name)"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (authorizationId) {
      query = query.eq("authorization_id", authorizationId);
    }

    const { data, error } = await query;

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ events: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
