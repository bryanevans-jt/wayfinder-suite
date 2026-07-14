import { createServerClient, isEsRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_NOT_FOUND,
} from "@wayfinder/supabase/error-log";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/messages/send";
  try {
    await assertNotPreviewMutation();

    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const supabase = await createServerClient();
    const actor = await resolveErrorActor(supabase, session.actorUserId);
    const role = session.effectiveRole ?? "";
    const staffUserId = session.effectiveUserId;

    const payload = (await request.json()) as { threadId?: string; body?: string };
    const threadId = payload.threadId;
    const text = payload.body?.trim();

    if (!threadId || !text) {
      return NextResponse.json({ error: "Please enter a message before sending." }, { status: 400 });
    }

    let admin;
    try {
      admin = createServiceRoleClient();
    } catch (err) {
      return respondWithLoggedError(
        "staff",
        route,
        err instanceof Error ? err : new Error("Missing SUPABASE_SERVICE_ROLE_KEY"),
        actor,
        503
      );
    }

    const { data: thread } = await admin
      .from("client_message_threads")
      .select("id, client_id, current_es_user_id")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread) {
      return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
    }

    let senderRole: "es" | "supervisor" | null = null;

    if (thread.current_es_user_id === staffUserId) {
      if (isEsRole(role)) {
        senderRole = "es";
      } else if (role === "supervisor") {
        const assigned =
          thread.client_id != null &&
          (await esIsAssignedToClient(staffUserId, thread.client_id as string));
        senderRole = assigned ? "es" : null;
      }
    } else if (role === "supervisor") {
      const { data: link } = await admin
        .from("supervisor_es_assignments")
        .select("es_user_id")
        .eq("supervisor_user_id", staffUserId)
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

    const { error: msgErr } = await admin.from("client_messages").insert({
      thread_id: threadId,
      sender_user_id: staffUserId,
      sender_role: senderRole,
      body: text,
    });

    if (msgErr) {
      return respondWithLoggedError("staff", route, msgErr, actor);
    }

    await admin
      .from("client_message_threads")
      .update({ last_es_message_at: now })
      .eq("id", threadId);

    if (thread.client_id) {
      const { data: client } = await admin
        .from("clients")
        .select("user_id, profile_id")
        .eq("id", thread.client_id)
        .maybeSingle();

      const notifyUserId =
        (client?.user_id as string | null) ?? (client?.profile_id as string | null) ?? null;

      if (notifyUserId) {
        await notifyUser(admin, {
          userId: notifyUserId,
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
