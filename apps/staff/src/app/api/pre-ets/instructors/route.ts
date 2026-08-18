import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/pre-ets/instructors";
  const auth = await requirePreEtsApi("supervise");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, role")
      .eq("is_active", true)
      .in("role", ["instructor", "es", "supervisor"])
      .order("full_name");

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ staff: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
