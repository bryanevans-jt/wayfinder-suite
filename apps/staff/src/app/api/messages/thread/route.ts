import { createServerClient, isEsRole, isSupervisorTierRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_NOT_FOUND,
  USER_FACING_SYSTEM_ERROR,
} from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/messages/thread";
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const threadId = new URL(request.url).searchParams.get("id");
    if (!threadId) {
      return NextResponse.json({ error: "Please select a conversation." }, { status: 400 });
    }

    const role = session.effectiveRole ?? "";
    const effectiveUserId = session.effectiveUserId;

    const supabase = await createServerClient();
    const actor = await resolveErrorActor(supabase, session.actorUserId);

    let admin;
    try {
      admin = createServiceRoleClient();
    } catch {
      return NextResponse.json({ error: USER_FACING_SYSTEM_ERROR }, { status: 503 });
    }

    const { data: thread } = await admin
      .from("client_message_threads")
      .select("id, current_es_user_id")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread) {
      return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
    }

    const isEs = isEsRole(role) && thread.current_es_user_id === effectiveUserId;
    let isSupervisor = false;
    if (isSupervisorTierRole(role) && role === "supervisor") {
      const { data: link } = await admin
        .from("supervisor_es_assignments")
        .select("es_user_id")
        .eq("supervisor_user_id", effectiveUserId)
        .eq("es_user_id", thread.current_es_user_id)
        .maybeSingle();
      isSupervisor = Boolean(link);
    }

    if (!isEs && !isSupervisor && role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const { data: messages, error } = await admin
      .from("client_messages")
      .select("id, body, sender_role, sender_user_id, created_at")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true });

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    const senderIds = [...new Set((messages ?? []).map((m) => m.sender_user_id as string))];
    const { data: profiles } = senderIds.length
      ? await admin.from("profiles").select("id, full_name").in("id", senderIds)
      : { data: [] as { id: string; full_name: string | null }[] };

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return NextResponse.json({
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        body: m.body,
        sender_role: m.sender_role,
        created_at: m.created_at,
        sender_name: nameById.get(m.sender_user_id as string) ?? null,
      })),
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}
