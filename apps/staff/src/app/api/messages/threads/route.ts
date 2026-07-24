import { createServerClient, isEsRole, isEsReplyOverdue, isSupervisorTierRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { loadStaffNameById } from "@/lib/operations-data";
import { loadSupervisorScope } from "@/lib/supervisor-client-scope";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
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

    const filterEs = request.nextUrl.searchParams.get("es")?.trim() || "";
    const filterClient = request.nextUrl.searchParams.get("client")?.trim() || "";

    const supabase = await createServerClient();
    const effectiveUserId = session.effectiveUserId;
    const actor = await resolveErrorActor(supabase, session.actorUserId);

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

    let supervisedEsIds: string[] = [];

    let threadsQuery = admin
      .from("client_message_threads")
      .select("id, client_id, client_label, current_es_user_id, last_client_message_at, last_es_message_at");

    if (isEs) {
      threadsQuery = threadsQuery.eq("current_es_user_id", effectiveUserId);
    } else if (role === "supervisor") {
      const scope = await loadSupervisorScope(admin, effectiveUserId);
      supervisedEsIds = [...new Set(scope.esUserIds)];
      if (supervisedEsIds.length === 0) {
        return NextResponse.json({
          threads: [],
          role: "supervisor",
          readOnly: session.isPreviewing,
          filters: { esUsers: [], clients: [] },
        });
      }
      threadsQuery = threadsQuery.in("current_es_user_id", supervisedEsIds);
    }

    const { data: threads, error } = await threadsQuery.order("last_client_message_at", {
      ascending: false,
      nullsFirst: false,
    });

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    let filteredThreads = threads ?? [];

    if (isSupervisor && filterEs) {
      if (!supervisedEsIds.includes(filterEs)) {
        return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
      }
      filteredThreads = filteredThreads.filter(
        (t) => (t.current_es_user_id as string) === filterEs
      );
    }

    if (filterClient) {
      filteredThreads = filteredThreads.filter((t) => (t.client_id as string | null) === filterClient);
    }

    const threadIds = filteredThreads.map((t) => t.id as string);
    const { data: dismissals } = threadIds.length
      ? await admin
          .from("message_sla_dismissals")
          .select("thread_id")
          .in("thread_id", threadIds)
          .eq("dismissed_by", session.actorUserId)
      : { data: [] as { thread_id: string }[] };

    const dismissed = new Set((dismissals ?? []).map((d) => d.thread_id));

    const summaries = await Promise.all(
      filteredThreads.map(async (t) => {
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
            .select("contact_email, full_name")
            .eq("id", t.client_id)
            .maybeSingle();
          clientLabel =
            (clientRow?.full_name as string | null) ??
            (clientRow?.contact_email as string | null) ??
            null;
        }

        return {
          threadId: t.id,
          clientId: t.client_id,
          clientLabel,
          esUserId: t.current_es_user_id as string | null,
          esName,
          overdue,
          lastPreview: (lastMsg?.body as string | undefined)?.slice(0, 80) ?? null,
        };
      })
    );

    let filterEsUsers: { id: string; name: string }[] = [];
    let filterClients: { id: string; name: string }[] = [];

    if (isSupervisor) {
      const esIdsInThreads = [
        ...new Set(
          (threads ?? [])
            .map((t) => t.current_es_user_id as string | null)
            .filter((id): id is string => Boolean(id))
        ),
      ];
      if (esIdsInThreads.length > 0) {
        const nameById = await loadStaffNameById(admin, esIdsInThreads);
        filterEsUsers = [...nameById.entries()]
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      }

      const clientIds = [
        ...new Set(
          (threads ?? [])
            .map((t) => t.client_id as string | null)
            .filter((id): id is string => Boolean(id))
        ),
      ];
      if (clientIds.length > 0) {
        const { data: clientRows } = await admin
          .from("clients")
          .select("id, full_name, contact_email")
          .in("id", clientIds);
        filterClients = (clientRows ?? [])
          .map((c) => ({
            id: c.id as string,
            name:
              (c.full_name as string | null)?.trim() ||
              (c.contact_email as string | null)?.trim() ||
              (c.id as string).slice(0, 8),
          }))
          .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      }
    }

    return NextResponse.json({
      threads: summaries,
      role: isSupervisor ? "supervisor" : "es",
      readOnly: session.isPreviewing,
      filters: isSupervisor ? { esUsers: filterEsUsers, clients: filterClients } : undefined,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}
