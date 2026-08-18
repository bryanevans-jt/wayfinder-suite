import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/search";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const type = url.searchParams.get("type") ?? "all";
  const month = url.searchParams.get("month");

  if (!q && !month) {
    return NextResponse.json({ results: [] });
  }

  try {
    const admin = createServiceRoleClient();
    const results: Record<string, unknown>[] = [];

    if ((type === "all" || type === "student") && q) {
      const { data } = await admin
        .from("pre_ets_students")
        .select("id, participant_id, full_name, school_year")
        .or(`full_name.ilike.%${q}%,participant_id.ilike.%${q}%`)
        .limit(25);
      for (const row of data ?? []) {
        results.push({ kind: "student", ...row });
      }
    }

    if ((type === "all" || type === "school") && q) {
      const { data } = await admin
        .from("pre_ets_schools")
        .select("id, name, district_id, pre_ets_districts(gvra_district_number, school_year)")
        .ilike("name", `%${q}%`)
        .limit(25);
      for (const row of data ?? []) {
        results.push({ kind: "school", ...row });
      }
    }

    if ((type === "all" || type === "authorization") && q) {
      const { data } = await admin
        .from("pre_ets_authorizations")
        .select(
          "id, auth_number, auth_type, service_code, service_month, school_id, pre_ets_schools(name)"
        )
        .ilike("auth_number", `%${q}%`)
        .limit(25);
      for (const row of data ?? []) {
        results.push({ kind: "authorization", ...row });
      }
    }

    if (type === "month" && month) {
      const serviceMonth = month.length === 7 ? `${month}-01` : month;
      const { data } = await admin
        .from("pre_ets_authorizations")
        .select(
          "id, auth_number, auth_type, service_code, service_month, pre_ets_schools(name)"
        )
        .eq("service_month", serviceMonth)
        .limit(100);
      for (const row of data ?? []) {
        results.push({ kind: "month_auth", ...row });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
