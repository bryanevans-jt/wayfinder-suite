import { verifyPreviewHandoff } from "@wayfinder/supabase/preview-handoff";
import {
  PREVIEW_ACTOR_COOKIE,
  PREVIEW_NAME_COOKIE,
  PREVIEW_ROLE_COOKIE,
  PREVIEW_TARGET_COOKIE,
  previewCookieOptions,
} from "@wayfinder/supabase/preview-cookies";
import { createServerClient } from "@wayfinder/supabase";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token")?.trim();
  if (!token) {
    return new NextResponse("Missing preview token.", { status: 400 });
  }

  const payload = verifyPreviewHandoff(token);
  if (!payload) {
    return new NextResponse("Preview link expired or invalid. Start preview again from Wayfinder Pro.", {
      status: 400,
    });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.id !== payload.actorUserId) {
    return new NextResponse("Sign in as the super admin who started this preview, then try again.", {
      status: 401,
    });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !isSuperAdminRole(profile.role)) {
    return new NextResponse("Super admin access required for client preview.", { status: 403 });
  }

  const redirectUrl = new URL("/dashboard", url.origin);
  const response = NextResponse.redirect(redirectUrl);

  const opts = previewCookieOptions();
  response.cookies.set(PREVIEW_TARGET_COOKIE, payload.targetUserId, opts);
  response.cookies.set(PREVIEW_ACTOR_COOKIE, payload.actorUserId, opts);
  response.cookies.set(PREVIEW_ROLE_COOKIE, payload.targetRole, opts);
  if (payload.targetName) {
    response.cookies.set(PREVIEW_NAME_COOKIE, payload.targetName, opts);
  }

  return response;
}
