import { staffAppOrigin } from "@wayfinder/supabase/preview-server";
import { stopPreviewSession } from "@wayfinder/supabase/preview-stop";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { createClient } from "@wayfinder/supabase/server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const home = () => `${staffAppOrigin()}/dashboard/super-admin`;

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieGet = (name: string) => {
    const match = cookieHeader.match(
      new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
    );
    return match ? decodeURIComponent(match[1]!) : undefined;
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${staffAppOrigin()}/login`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !isSuperAdminRole(profile.role)) {
    const response = NextResponse.redirect(home());
    await stopPreviewSession(cookieGet, response);
    return response;
  }

  const response = NextResponse.redirect(home());
  await stopPreviewSession(cookieGet, response);
  return response;
}

export async function POST() {
  const cookieStore = await cookies();
  const cookieGet = (name: string) => cookieStore.get(name)?.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active || !isSuperAdminRole(profile.role)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const response = NextResponse.json({ ok: true, redirectUrl: home() });
  await stopPreviewSession(cookieGet, response);
  return response;
}
