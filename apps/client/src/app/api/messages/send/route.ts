import { createServerClient, requireClientMessageApiContext } from "@wayfinder/supabase";
import {
  respondWithLoggedError,
  resolveErrorActor,
} from "@wayfinder/supabase/error-log";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/messages/send";
  try {
    const supabase = await createServerClient();
    const auth = await requireClientMessageApiContext(supabase);
    if ("error" in auth) {
      return auth.error;
    }

    const { ctx } = auth;
    const actor = await resolveErrorActor(supabase, ctx.userId);

    const payload = (await request.json()) as { body?: string };
    const text = payload.body?.trim();
    if (!text) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let { data: thread } = await ctx.admin
      .from("client_message_threads")
      .select("id, current_es_user_id")
      .eq("client_id", ctx.clientId)
      .maybeSingle();

    if (!thread) {
      const { data: assignment } = await ctx.admin
        .from("es_client_assignments")
        .select("es_user_id")
        .eq("client_id", ctx.clientId)
        .limit(1)
        .maybeSingle();

      if (!assignment?.es_user_id) {
        return NextResponse.json(
          { error: "No employment specialist assigned yet" },
          { status: 400 }
        );
      }

      const { data: created, error: threadErr } = await ctx.admin
        .from("client_message_threads")
        .upsert(
          { client_id: ctx.clientId, current_es_user_id: assignment.es_user_id },
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

    const { error: msgErr } = await ctx.admin.from("client_messages").insert({
      thread_id: thread.id,
      sender_user_id: ctx.userId,
      sender_role: "client",
      body: text,
    });

    if (msgErr) {
      return respondWithLoggedError("client", route, msgErr, actor);
    }

    await ctx.admin
      .from("client_message_threads")
      .update({ last_client_message_at: now })
      .eq("id", thread.id);

    if (thread.current_es_user_id) {
      await notifyUser(ctx.admin, {
        userId: thread.current_es_user_id,
        kind: "client_message",
        title: "New client message",
        body: text.slice(0, 120),
        link_path: "/dashboard/messages",
        metadata: { thread_id: thread.id, client_id: ctx.clientId },
        app: "staff",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}
