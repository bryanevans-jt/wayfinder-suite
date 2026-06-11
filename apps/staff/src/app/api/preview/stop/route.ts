import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  PREVIEW_COOKIE_NAMES,
  previewCookieOptions,
  readPreviewCookies,
} from "@wayfinder/supabase/preview-cookies";
import { staffAppOrigin } from "@wayfinder/supabase/preview-server";
import { createClient } from "@wayfinder/supabase/server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function clearPreviewCookies(response: NextResponse) {
  const cleared = previewCookieOptions(0);
  for (const name of PREVIEW_COOKIE_NAMES) {
    response.cookies.set(name, "", cleared);
  }
}

async function stopPreview(redirect: boolean, cookieGet: (name: string) => string | undefined) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const home = `${staffAppOrigin()}/dashboard/super-admin`;

  if (!user) {
    if (redirect) {
      return NextResponse.redirect(`${staffAppOrigin()}/login`);
    }
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !isSuperAdminRole(profile.role)) {
    if (redirect) {
      return NextResponse.redirect(home);
    }
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const preview = readPreviewCookies(cookieGet);
  const targetUserId = preview?.targetUserId ?? null;

  if (targetUserId) {
    const admin = createServiceRoleClient();

    await admin.from("preview_audit_logs").insert({
      actor_user_id: user.id,
      target_user_id: targetUserId,
      target_role: preview?.targetRole ?? "unknown",
      action: "exit",
    });
  }

  if (redirect) {
    const response = NextResponse.redirect(home);
    clearPreviewCookies(response);
    return response;
  }

  const response = NextResponse.json({ ok: true, redirectUrl: home });
  clearPreviewCookies(response);
  return response;
}

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieGet = (name: string) => {
    const match = cookieHeader.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`));
    return match ? decodeURIComponent(match[1]!) : undefined;
  };
  return stopPreview(true, cookieGet);
}

export async function POST() {
  const cookieStore = await cookies();
  return stopPreview(false, (name) => cookieStore.get(name)?.value);
}
