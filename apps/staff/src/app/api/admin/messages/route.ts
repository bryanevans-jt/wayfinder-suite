import { createServerClient, isAdminTierRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

type ThreadJoin = {
  client_id?: string | null;
  client_label?: string | null;
} | null;

type MessageRow = {
  id: string;
  body: string;
  sender_role: string;
  sender_user_id: string;
  created_at: string;
  thread_id: string;
  client_message_threads: ThreadJoin | ThreadJoin[];
};

function threadMeta(row: MessageRow): { client_id: string | null; client_label: string | null } {
  const raw = row.client_message_threads;
  const thread = Array.isArray(raw) ? raw[0] : raw;
  return {
    client_id: thread?.client_id ?? null,
    client_label: thread?.client_label ?? null,
  };
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function assertAdminTier() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 }) };
  }

  const actor = await resolveErrorActor(supabase, user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isAdminTierRole(profile?.role)) {
    return { error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }) };
  }

  return { supabase, user, role: profile?.role ?? null, actor };
}

export async function GET(request: Request) {
  const route = "api/admin/messages";
  try {
    const auth = await assertAdminTier();
    if (auth.error) return auth.error;
    const { supabase, actor } = auth;

    const url = new URL(request.url);
    if (url.searchParams.get("purgeRuns") === "1") {
      const { data: runs, error } = await supabase
        .from("message_retention_purge_runs")
        .select("id, purged_before, message_count, trigger_kind, created_at, triggered_by")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        return respondWithLoggedError("staff", route, error, actor);
      }

      const triggerIds = [
        ...new Set((runs ?? []).map((r) => r.triggered_by as string | null).filter(Boolean)),
      ] as string[];
      const { data: profiles } = triggerIds.length
        ? await supabase.from("profiles").select("id, full_name").in("id", triggerIds)
        : { data: [] as { id: string; full_name: string | null }[] };
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

      return NextResponse.json({
        purgeRuns: (runs ?? []).map((run) => ({
          id: run.id,
          purged_before: run.purged_before,
          message_count: run.message_count,
          trigger_kind: run.trigger_kind,
          created_at: run.created_at,
          triggered_by_name: run.triggered_by
            ? (nameById.get(run.triggered_by as string) ?? null)
            : null,
        })),
      });
    }

    const clientId = url.searchParams.get("clientId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const format = url.searchParams.get("format");

    let query = supabase
      .from("client_messages")
      .select(
        "id, body, sender_role, sender_user_id, created_at, thread_id, client_message_threads(client_id, client_label)"
      )
      .order("created_at", { ascending: true });

    if (from) {
      query = query.gte("created_at", from);
    }
    if (to) {
      query = query.lte("created_at", to);
    }

    const { data: rows, error } = await query.limit(5000);

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    const filtered = ((rows ?? []) as MessageRow[]).filter((row) => {
      if (!clientId) {
        return true;
      }
      return threadMeta(row).client_id === clientId;
    });

    const senderIds = [
      ...new Set(filtered.map((row) => row.sender_user_id).filter(Boolean)),
    ] as string[];
    const { data: profiles } = senderIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", senderIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    const messages = filtered.map((row) => {
      const meta = threadMeta(row);
      return {
        id: row.id,
        body: row.body,
        sender_role: row.sender_role,
        sender_name: nameById.get(row.sender_user_id) ?? null,
        created_at: row.created_at,
        thread_id: row.thread_id,
        client_id: meta.client_id,
        client_label: meta.client_label,
      };
    });

    if (format === "csv") {
      const lines = ["timestamp,client,sender_role,sender_name,body"];
      for (const row of messages) {
        const client = row.client_label ?? row.client_id ?? "";
        const body = csvEscape(String(row.body));
        const senderName = csvEscape(row.sender_name ?? "");
        lines.push(
          `${row.created_at},${csvEscape(String(client))},${row.sender_role},${senderName},${body}`
        );
      }

      return new NextResponse(lines.join("\n"), {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="wayfinder-message-audit.csv"',
        },
      });
    }

    return NextResponse.json({ messages });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}

export async function DELETE(request: Request) {
  const route = "api/admin/messages";
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

    if (profile?.role !== "super_admin") {
      return NextResponse.json(
        { error: "Only super admins can purge message history." },
        { status: 403 }
      );
    }

    const payload = (await request.json()) as { before?: string; triggerKind?: string };
    const before =
      payload.before ?? new Date(Date.now() - 183 * 24 * 60 * 60 * 1000).toISOString();

    const admin = createServiceRoleClient();

    const { data: oldMessages, error: selectErr } = await admin
      .from("client_messages")
      .select("id")
      .lt("created_at", before);

    if (selectErr) {
      return respondWithLoggedError("staff", route, selectErr, actor);
    }

    const ids = (oldMessages ?? []).map((m) => m.id as string);
    if (ids.length > 0) {
      const { error: delErr } = await admin.from("client_messages").delete().in("id", ids);
      if (delErr) {
        return respondWithLoggedError("staff", route, delErr, actor);
      }
    }

    await admin.from("message_retention_purge_runs").insert({
      purged_before: before,
      message_count: ids.length,
      triggered_by: user.id,
      trigger_kind: payload.triggerKind === "scheduled" ? "scheduled" : "manual",
    });

    return NextResponse.json({ purged: ids.length, before });
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}
