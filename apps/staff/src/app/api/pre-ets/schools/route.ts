import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/pre-ets/schools";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("pre_ets_schools")
      .select("id, name, district_id")
      .order("name");

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ schools: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
