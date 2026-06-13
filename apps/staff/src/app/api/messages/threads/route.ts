import { createServerClient, isEsRole, isEsReplyOverdue, isSupervisorTierRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_SYSTEM_ERROR,
} from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/messages/threads";
  try {
    const session = await getAppSession();
    if (!session) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const role = session.effectiveRole ?? "";
    const isEs = isEsRole(role);
    const isSupervisor = isSupervisorTierRole(role) && !isEs;

    if (!isEs && !isSupervisor) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const supabase = await createServerClient();
    const effectiveUserId = session.effectiveUserId;
    const actor = await resolveErrorActor(supabase, session.actorUserId);

    let admin;
    try {
      admin = createServiceRoleClient();
    } catch {
      return NextResponse.json({ error: USER_FACING_SYSTEM_ERROR }, { status: 503 });
    }

    let threadsQuery = admin
      .from("client_message_threads")
      .select("id, client_id, client_label, current_es_user_id, last_client_message_at, last_es_message_at");

    if (isEs) {
      threadsQuery = threadsQuery.eq("current_es_user_id", effectiveUserId);
    } else if (role === "supervisor") {
      const { data: links } = await admin
        .from("supervisor_es_assignments")
        .select("es_user_id")
        .eq("supervisor_user_id", effectiveUserId);
      const esIds = (links ?? []).map((l) => l.es_user_id as string);
      if (esIds.length === 0) {
        return NextResponse.json({ threads: [], role });
      }
      threadsQuery = threadsQuery.in("current_es_user_id", esIds);
    }

    const { data: threads, error } = await threadsQuery.order("last_client_message_at", {
      ascending: false,
      nullsFirst: false,
    });

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    const threadIds = (threads ?? []).map((t) => t.id as string);
    const { data: dismissals } = threadIds.length
      ? await admin
          .from("message_sla_dismissals")
          .select("thread_id")
          .in("thread_id", threadIds)
          .eq("dismissed_by", session.actorUserId)
      : { data: [] as { thread_id: string }[] };

    const dismissed = new Set((dismissals ?? []).map((d) => d.thread_id));

    const summaries = await Promise.all(
      (threads ?? []).map(async (t) => {
        const overdue =
          isEsReplyOverdue(t.last_client_message_at as string, t.last_es_message_at as string) &&
          !dismissed.has(t.id as string);

        const { data: lastMsg } = await admin
          .from("client_messages")
          .select("body")
          .eq("thread_id", t.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let esName: string | null = null;
        if (t.current_es_user_id) {
          const { data: esProfile } = await admin
            .from("profiles")
            .select("full_name")
            .eq("id", t.current_es_user_id)
            .maybeSingle();
          esName = esProfile?.full_name ?? null;
        }

        let clientLabel = t.client_label as string | null;
        if (!clientLabel && t.client_id) {
          const { data: clientRow } = await admin
            .from("clients")
            .select("contact_email")
            .eq("id", t.client_id)
            .maybeSingle();
          clientLabel = (clientRow?.contact_email as string | null) ?? null;
        }

        return {
          threadId: t.id,
          clientId: t.client_id,
          clientLabel,
          esName,
          overdue,
          lastPreview: (lastMsg?.body as string | undefined)?.slice(0, 80) ?? null,
        };
      })
    );

    return NextResponse.json({
      threads: summaries,
      role: isSupervisor ? "supervisor" : "es",
      readOnly: session.isPreviewing,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}
