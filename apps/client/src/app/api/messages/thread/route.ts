import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

async function getClientUser(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "client") {
    return null;
  }

  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!client?.id) {
    return null;
  }

  return { user, clientId: client.id as string };
}

export async function GET() {
  const route = "api/messages/thread";
  try {
    const supabase = await createServerClient();
    const ctx = await getClientUser(supabase);
    if (!ctx) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, ctx.user.id);

    let { data: thread } = await supabase
      .from("client_message_threads")
      .select("id, current_es_user_id")
      .eq("client_id", ctx.clientId)
      .maybeSingle();

    if (!thread) {
      const { data: assignment } = await supabase
        .from("es_client_assignments")
        .select("es_user_id")
        .eq("client_id", ctx.clientId)
        .limit(1)
        .maybeSingle();

      if (assignment?.es_user_id) {
        const admin = createServiceRoleClient();
        const { error: upsertErr } = await admin.from("client_message_threads").upsert(
          {
            client_id: ctx.clientId,
            current_es_user_id: assignment.es_user_id,
          },
          { onConflict: "client_id" }
        );
        if (upsertErr) {
          return respondWithLoggedError("client", route, upsertErr, actor);
        }
        const refetch = await supabase
          .from("client_message_threads")
          .select("id, current_es_user_id")
          .eq("client_id", ctx.clientId)
          .maybeSingle();
        thread = refetch.data;
      }
    }

    if (!thread) {
      return NextResponse.json({ threadId: null, esName: null, messages: [] });
    }

    let esName: string | null = null;
    if (thread.current_es_user_id) {
      const { data: esProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", thread.current_es_user_id)
        .maybeSingle();
      esName = esProfile?.full_name ?? null;
    }

    const { data: messages, error } = await supabase
      .from("client_messages")
      .select("id, body, sender_role, sender_user_id, created_at")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    if (error) {
      return respondWithLoggedError("client", route, error, actor);
    }

    const senderIds = [...new Set((messages ?? []).map((m) => m.sender_user_id as string))];
    const { data: profiles } = senderIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", senderIds)
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
    });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}
