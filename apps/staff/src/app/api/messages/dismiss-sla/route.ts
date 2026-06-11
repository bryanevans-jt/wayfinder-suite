import { isSupervisorTierRole } from "@wayfinder/supabase";
import { createServerClient } from "@wayfinder/supabase";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/messages/dismiss-sla";
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!isSupervisorTierRole(profile?.role)) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const payload = (await request.json()) as { threadId?: string };
    if (!payload.threadId) {
      return NextResponse.json({ error: "Please select a conversation." }, { status: 400 });
    }

    const { error } = await supabase.from("message_sla_dismissals").upsert(
      {
        thread_id: payload.threadId,
        dismissed_by: user.id,
        dismissed_at: new Date().toISOString(),
      },
      { onConflict: "thread_id,dismissed_by" }
    );

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}
