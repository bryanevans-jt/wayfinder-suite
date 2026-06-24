import { createServerClient } from "@wayfinder/supabase";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
