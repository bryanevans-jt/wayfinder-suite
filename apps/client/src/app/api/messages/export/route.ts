import { createServerClient } from "@wayfinder/supabase";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_NOT_FOUND,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/messages/export";
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

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!client?.id) {
      return NextResponse.json({ error: USER_FACING_NOT_FOUND }, { status: 404 });
    }

    const { data: thread } = await supabase
      .from("client_message_threads")
      .select("id")
      .eq("client_id", client.id)
      .maybeSingle();

    if (!thread?.id) {
      return new NextResponse("timestamp,sender_role,body\n", {
        headers: { "Content-Type": "text/csv" },
      });
    }

    let query = supabase
      .from("client_messages")
      .select("created_at, sender_role, body")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    if (from) {
      query = query.gte("created_at", from);
    }
    if (to) {
      query = query.lte("created_at", to);
    }

    const { data: rows, error } = await query;
    if (error) {
      return respondWithLoggedError("client", route, error, actor);
    }

    const lines = ["timestamp,sender_role,body"];
    for (const row of rows ?? []) {
      const body = `"${String(row.body).replace(/"/g, '""')}"`;
      lines.push(`${row.created_at},${row.sender_role},${body}`);
    }

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="wayfinder-messages.csv"',
      },
    });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}
