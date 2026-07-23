import { createServerClient } from "@wayfinder/supabase";
import { requireClientMessageApiContext } from "@wayfinder/supabase/client-message-api";
import {
  respondWithLoggedError,
  resolveErrorActor,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/messages/thread";
  try {
    const supabase = await createServerClient();
    const auth = await requireClientMessageApiContext(supabase);
    if ("error" in auth) {
      return auth.error;
    }

    const { ctx } = auth;
    const actor = await resolveErrorActor(supabase, ctx.userId);

    let { data: thread } = await ctx.admin
      .from("client_message_threads")
      .select("id, current_es_user_id")
      .eq("client_id", ctx.clientId)
      .maybeSingle();

    if (!thread && !ctx.isReadOnlyPreview) {
      const { data: assignment } = await ctx.admin
        .from("es_client_assignments")
        .select("es_user_id")
        .eq("client_id", ctx.clientId)
        .limit(1)
        .maybeSingle();

      if (assignment?.es_user_id) {
        const { error: upsertErr } = await ctx.admin.from("client_message_threads").upsert(
          {
            client_id: ctx.clientId,
            current_es_user_id: assignment.es_user_id,
          },
          { onConflict: "client_id" }
        );
        if (upsertErr) {
          return respondWithLoggedError("client", route, upsertErr, actor);
        }
        const refetch = await ctx.admin
          .from("client_message_threads")
          .select("id, current_es_user_id")
          .eq("client_id", ctx.clientId)
          .maybeSingle();
        thread = refetch.data;
      }
    }

    if (!thread) {
      // Preview: still resolve ES name from assignment without creating a thread.
      if (ctx.isReadOnlyPreview) {
        const { data: assignment } = await ctx.admin
          .from("es_client_assignments")
          .select("es_user_id")
          .eq("client_id", ctx.clientId)
          .limit(1)
          .maybeSingle();
        let esName: string | null = null;
        if (assignment?.es_user_id) {
          const { data: esProfile } = await ctx.admin
            .from("profiles")
            .select("full_name")
            .eq("id", assignment.es_user_id)
            .maybeSingle();
          esName = esProfile?.full_name ?? null;
        }
        return NextResponse.json({
          threadId: null,
          esName,
          messages: [],
          isReadOnlyPreview: true,
        });
      }
      return NextResponse.json({
        threadId: null,
        esName: null,
        messages: [],
        isReadOnlyPreview: false,
      });
    }

    let esName: string | null = null;
    if (thread.current_es_user_id) {
      const { data: esProfile } = await ctx.admin
        .from("profiles")
        .select("full_name")
        .eq("id", thread.current_es_user_id)
        .maybeSingle();
      esName = esProfile?.full_name ?? null;
    }

    const { data: messages, error } = await ctx.admin
      .from("client_messages")
      .select("id, body, sender_role, sender_user_id, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    if (error) {
      return respondWithLoggedError("client", route, error, actor);
    }

    const senderIds = [...new Set((messages ?? []).map((m) => m.sender_user_id as string))];
    const { data: profiles } = senderIds.length
      ? await ctx.admin.from("profiles").select("id, full_name").in("id", senderIds)
      : { data: [] as { id: string; full_name: string | null }[] };

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return NextResponse.json({
      threadId: thread.id,
      esName,
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        body: m.body,
        sender_role: m.sender_role,
        created_at: m.created_at,
        sender_name: nameById.get(m.sender_user_id as string) ?? null,
      })),
      isReadOnlyPreview: ctx.isReadOnlyPreview,
    });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}
