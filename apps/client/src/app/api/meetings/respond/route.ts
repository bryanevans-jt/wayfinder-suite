import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_NOT_FOUND,
} from "@wayfinder/supabase/error-log";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/meetings/respond";
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

    if (profile?.role !== "client") {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const payload = (await request.json()) as { meetingId?: string; action?: string };
    const meetingId = payload.meetingId;
    const action = payload.action;

    if (!meetingId || (action !== "accept" && action !== "decline")) {
      return NextResponse.json(
        { error: "Please choose to accept or decline this meeting." },
        { status: 400 }
      );
    }

    const { data: meeting } = await supabase
      .from("client_meeting_requests")
      .select("id, client_id, es_user_id, status, starts_at, location, service_id")
      .eq("id", meetingId)
      .maybeSingle();

    if (!meeting || meeting.status !== "pending") {
      return NextResponse.json(
        { error: "This meeting request is no longer available." },
        { status: 404 }
      );
    }

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .eq("id", meeting.client_id)
      .maybeSingle();

    if (!client) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const status = action === "accept" ? "accepted" : "declined";
    const now = new Date().toISOString();

    const { error: updErr } = await supabase
      .from("client_meeting_requests")
      .update({ status, responded_at: now })
      .eq("id", meetingId);

    if (updErr) {
      return respondWithLoggedError("client", route, updErr, actor);
    }

    const admin = createServiceRoleClient();
    if (meeting.es_user_id) {
      await notifyUser(admin, {
        userId: meeting.es_user_id,
        kind: action === "accept" ? "meeting_accepted" : "meeting_declined",
        title: action === "accept" ? "Meeting accepted" : "Meeting declined",
        body: `Client ${action === "accept" ? "accepted" : "declined"} your meeting request.`,
        link_path: `/dashboard/clients/${meeting.client_id}`,
        metadata: { meeting_id: meetingId },
        app: "staff",
      });
    }

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}
