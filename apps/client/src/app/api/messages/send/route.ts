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
  const route = "api/messages/send";
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

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!client?.id) {
      return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
    }

    const payload = (await request.json()) as { body?: string };
    const text = payload.body?.trim();
    if (!text) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let { data: thread } = await supabase
      .from("client_message_threads")
      .select("id, current_es_user_id")
      .eq("client_id", client.id)
      .maybeSingle();

    const admin = createServiceRoleClient();

    if (!thread) {
      const { data: assignment } = await supabase
        .from("es_client_assignments")
        .select("es_user_id")
        .eq("client_id", client.id)
        .limit(1)
        .maybeSingle();

      if (!assignment?.es_user_id) {
        return NextResponse.json(
          { error: "No employment specialist assigned yet" },
          { status: 400 }
        );
      }

      const { data: created, error: threadErr } = await admin
        .from("client_message_threads")
        .upsert(
          { client_id: client.id, current_es_user_id: assignment.es_user_id },
          { onConflict: "client_id" }
        )
        .select("id, current_es_user_id")
        .maybeSingle();

      if (threadErr || !created) {
        return respondWithLoggedError(
          "client",
          route,
          threadErr ?? new Error("Could not open conversation"),
          actor
        );
      }
      thread = created;
    }

    const now = new Date().toISOString();

    const { error: msgErr } = await supabase.from("client_messages").insert({
      thread_id: thread.id,
      sender_user_id: user.id,
      sender_role: "client",
      body: text,
    });

    if (msgErr) {
      return respondWithLoggedError("client", route, msgErr, actor);
    }

    await supabase
      .from("client_message_threads")
      .update({ last_client_message_at: now })
      .eq("id", thread.id);

    if (thread.current_es_user_id) {
      await notifyUser(admin, {
        userId: thread.current_es_user_id,
        kind: "client_message",
        title: "New client message",
        body: text.slice(0, 120),
        link_path: "/dashboard/messages",
        metadata: { thread_id: thread.id, client_id: client.id },
        app: "staff",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}
