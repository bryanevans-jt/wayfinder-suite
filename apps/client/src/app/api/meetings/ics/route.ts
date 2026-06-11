import { buildMeetingIcs } from "@wayfinder/supabase/meeting-ics";
import { createServerClient } from "@wayfinder/supabase";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_NOT_FOUND,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/meetings/ics";
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Meeting not specified." }, { status: 400 });
    }

    const { data: meeting, error: meetingErr } = await supabase
      .from("client_meeting_requests")
      .select("id, starts_at, location, status, service_id, es_user_id, client_id")
      .eq("id", id)
      .maybeSingle();

    if (meetingErr) {
      return respondWithLoggedError("client", route, meetingErr, actor);
    }

    if (!meeting || meeting.status === "declined" || meeting.status === "cancelled") {
      return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
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

    let serviceName = "Wayfinder service";
    if (meeting.service_id) {
      const { data: svc } = await supabase
        .from("services")
        .select("name")
        .eq("id", meeting.service_id)
        .maybeSingle();
      if (svc?.name) {
        serviceName = svc.name;
      }
    }

    let esName = "Employment Specialist";
    if (meeting.es_user_id) {
      const { data: es } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", meeting.es_user_id)
        .maybeSingle();
      if (es?.full_name) {
        esName = es.full_name;
      }
    }

    const title = `${serviceName} meeting with ${esName}`;
    const ics = buildMeetingIcs({
      uid: `wayfinder-meeting-${meeting.id}@thejoshuatree.org`,
      title,
      description: title,
      location: meeting.location as string,
      startsAt: new Date(meeting.starts_at as string),
    });

    return new NextResponse(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="wayfinder-meeting.ics"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}
