import { createServerClient } from "@wayfinder/supabase";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const route = "api/accessibility";
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);
    const body = (await request.json()) as {
      accessibility_large_text?: boolean;
      accessibility_high_contrast?: boolean;
    };

    const { error } = await supabase
      .from("profiles")
      .update({
        accessibility_large_text: body.accessibility_large_text,
        accessibility_high_contrast: body.accessibility_high_contrast,
      })
      .eq("id", user.id);

    if (error) {
      return respondWithLoggedError("client", route, error, actor);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("client", route, err);
  }
}
