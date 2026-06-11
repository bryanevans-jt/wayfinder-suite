import { createServerClient } from "@wayfinder/supabase";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/notifications";
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);

    const { data, error } = await supabase
      .from("in_app_notifications")
      .select("id, kind, title, body, link_path, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      return respondWithLoggedError("client", route, error, actor);
    }

    const unread = (data ?? []).filter((n) => !n.read_at).length;
    return NextResponse.json({ notifications: data ?? [], unread });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}

export async function PATCH(request: Request) {
  const route = "api/notifications";
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);
    const payload = (await request.json()) as { ids?: string[]; markAll?: boolean };
    const now = new Date().toISOString();

    if (payload.markAll) {
      const { error } = await supabase
        .from("in_app_notifications")
        .update({ read_at: now })
        .eq("user_id", user.id)
        .is("read_at", null);
      if (error) {
        return respondWithLoggedError("client", route, error, actor);
      }
      return NextResponse.json({ ok: true });
    }

    if (payload.ids?.length) {
      const { error } = await supabase
        .from("in_app_notifications")
        .update({ read_at: now })
        .eq("user_id", user.id)
        .in("id", payload.ids);
      if (error) {
        return respondWithLoggedError("client", route, error, actor);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}
