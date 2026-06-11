import { createServerClient, isEsRole, isSupervisorTierRole } from "@wayfinder/supabase";
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

    const payload = (await request.json()) as { threadId?: string; body?: string };
    const threadId = payload.threadId;
    const text = payload.body?.trim();

    if (!threadId || !text) {
      return NextResponse.json({ error: "Please enter a message before sending." }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role ?? "";

    const { data: thread } = await supabase
      .from("client_message_threads")
      .select("id, client_id, current_es_user_id")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread) {
      return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
    }

    let senderRole: "es" | "supervisor" | null = null;

    if (isEsRole(role) && thread.current_es_user_id === user.id) {
      senderRole = "es";
    } else if (role === "supervisor") {
      const { data: link } = await supabase
        .from("supervisor_es_assignments")
        .select("es_user_id")
        .eq("supervisor_user_id", user.id)
        .eq("es_user_id", thread.current_es_user_id)
        .maybeSingle();
      if (link) {
        senderRole = "supervisor";
      }
    }

    if (!senderRole) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const now = new Date().toISOString();

    const { error: msgErr } = await supabase.from("client_messages").insert({
      thread_id: threadId,
      sender_user_id: user.id,
      sender_role: senderRole,
      body: text,
    });

    if (msgErr) {
      return respondWithLoggedError("staff", route, msgErr, actor);
    }

    await supabase
      .from("client_message_threads")
      .update({ last_es_message_at: now })
      .eq("id", threadId);

    if (thread.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("user_id")
        .eq("id", thread.client_id)
        .maybeSingle();

      if (client?.user_id) {
        const admin = createServiceRoleClient();
        await notifyUser(admin, {
          userId: client.user_id,
          kind: "es_message",
          title: senderRole === "supervisor" ? "Message from supervisor" : "Message from your ES",
          body: text.slice(0, 120),
          link_path: "/dashboard",
          metadata: { thread_id: threadId },
          app: "client",
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}
