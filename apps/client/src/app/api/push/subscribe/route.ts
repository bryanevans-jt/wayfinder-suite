import { isWebPushConfigured } from "@wayfinder/supabase/notify-user";
import { createServerClient } from "@wayfinder/supabase";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/push/subscribe";
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);

    const payload = (await request.json()) as {
      endpoint?: string;
      p256dh?: string;
      auth?: string;
    };

    if (!payload.endpoint || !payload.p256dh || !payload.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const { error } = await supabase.from("push_notification_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: payload.endpoint,
        p256dh: payload.p256dh,
        auth_key: payload.auth,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (error) {
      return respondWithLoggedError("client", route, error, actor);
    }

    return NextResponse.json({ ok: true, pushEnabled: isWebPushConfigured() });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}

export async function DELETE(request: Request) {
  const route = "api/push/subscribe";
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);

    const payload = (await request.json()) as { endpoint?: string };
    if (!payload.endpoint) {
      return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
    }

    const { error } = await supabase
      .from("push_notification_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint", payload.endpoint);

    if (error) {
      return respondWithLoggedError("client", route, error, actor);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}
