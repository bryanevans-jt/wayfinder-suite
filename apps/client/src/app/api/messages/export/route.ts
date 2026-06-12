import { createServerClient, requireClientMessageApiContext } from "@wayfinder/supabase";
import { respondWithLoggedError, resolveErrorActor } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/messages/export";
  try {
    const supabase = await createServerClient();
    const auth = await requireClientMessageApiContext(supabase);
    if ("error" in auth) {
      return auth.error;
    }

    const { ctx } = auth;
    const actor = await resolveErrorActor(supabase, ctx.userId);

    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const { data: thread } = await ctx.admin
      .from("client_message_threads")
      .select("id")
      .eq("client_id", ctx.clientId)
      .maybeSingle();

    if (!thread?.id) {
      return new NextResponse("timestamp,sender_role,body\n", {
        headers: { "Content-Type": "text/csv" },
      });
    }

    let query = ctx.admin
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
