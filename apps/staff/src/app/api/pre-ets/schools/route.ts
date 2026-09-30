import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { fetchAllPostgrestRows } from "@wayfinder/supabase/postgrest-fetch-all";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/pre-ets/schools";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const admin = createServiceRoleClient();
    const schools = await fetchAllPostgrestRows<{ id: string; name: string; district_id: string }>(
      admin,
      "pre_ets_schools",
      "id, name, district_id",
      { order: { column: "name", ascending: true } }
    );

    return NextResponse.json({ schools });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
