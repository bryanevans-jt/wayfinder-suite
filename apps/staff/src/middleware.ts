import { createServerClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isCounselorRole,
  staffHomePath,
  wayfinderServerAuthOptions,
} from "@wayfinder/supabase";
import { resolvePreviewSession } from "@wayfinder/supabase/preview-middleware";
import { wayfinderAuthMiddleware } from "@wayfinder/supabase/middleware-app";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isCounselorBlockedStaffPath,
  isPortalPath,
  portalPathAllowedForRole,
} from "@/lib/staff-nav";

export async function middleware(request: NextRequest) {
  const response = await wayfinderAuthMiddleware(request, { app: "staff" });

  const { pathname } = request.nextUrl;

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    ...wayfinderServerAuthOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return response;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const previewSession = resolvePreviewSession(
    request,
    user.id,
    profile?.role ?? ""
  );
  const role = previewSession.effectiveRole;

  if (isPortalPath(pathname) && !portalPathAllowedForRole(pathname, role)) {
    const url = request.nextUrl.clone();
    url.pathname = staffHomePath(role);
    return NextResponse.redirect(url);
  }

  if (!isCounselorBlockedStaffPath(pathname)) {
    return response;
  }

  if (!isCounselorRole(role)) {
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/dashboard/counselor";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
