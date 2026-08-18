import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/invoice-packets/[id]/events";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("pre_ets_invoice_packet_events")
      .select("id, event_kind, from_status, to_status, metadata, created_at, profiles(full_name)")
      .eq("packet_id", id)
      .order("created_at", { ascending: false })
      .limit(50);

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
