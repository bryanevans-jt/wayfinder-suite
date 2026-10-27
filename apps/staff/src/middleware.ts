import { createServerClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isCounselorRole,
  isGvraSupervisorRole,
  staffHomePath,
  type SupabaseCookieToSet,
  wayfinderServerAuthOptions,
} from "@wayfinder/supabase";
import { resolvePreviewSession } from "@wayfinder/supabase/preview-middleware";
import { wayfinderAuthMiddleware } from "@wayfinder/supabase/middleware-app";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isCounselorBlockedStaffPath,
  isGvraSupervisorBlockedStaffPath,
  isGvraSupervisorOnlyStaffPath,
  isPortalPath,
  isPreEtsStaffPath,
  isPreEtsInstructorBlockedStaffPath,
  portalPathAllowedForRole,
} from "@/lib/staff-nav";
import { isPreEtsApiPath, preEtsAccessAllowedForRole } from "@/lib/pre-ets-access";
import { isInstructorRole } from "@wayfinder/supabase/roles";
import { APP_VERSION } from "@wayfinder/branding";

function withDeployHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Wayfinder-Version", APP_VERSION);
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) response.headers.set("X-Wayfinder-Commit", sha.slice(0, 12));
  return response;
}

export async function middleware(request: NextRequest) {
  const response = withDeployHeaders(await wayfinderAuthMiddleware(request, { app: "staff" }));

  const { pathname } = request.nextUrl;

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    ...wayfinderServerAuthOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return withDeployHeaders(response);
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
    return withDeployHeaders(NextResponse.redirect(url));
  }

  if (isPreEtsStaffPath(pathname) || isPreEtsApiPath(pathname)) {
    const allowed = await preEtsAccessAllowedForRole(role);
    if (!allowed) {
      if (isPreEtsApiPath(pathname)) {
        return withDeployHeaders(NextResponse.json({ error: "Forbidden" }, { status: 403 }));
      }
      const url = request.nextUrl.clone();
      url.pathname = staffHomePath(role);
      return withDeployHeaders(NextResponse.redirect(url));
    }
  }

  if (isInstructorRole(role) && isPreEtsInstructorBlockedStaffPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = staffHomePath(role);
    return withDeployHeaders(NextResponse.redirect(url));
  }

  if (isGvraSupervisorOnlyStaffPath(pathname) && !isGvraSupervisorRole(role)) {
    const url = request.nextUrl.clone();
    url.pathname = staffHomePath(role);
    return withDeployHeaders(NextResponse.redirect(url));
  }

  if (isGvraSupervisorRole(role) && isGvraSupervisorBlockedStaffPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = staffHomePath(role);
    return withDeployHeaders(NextResponse.redirect(url));
  }

  if (!isCounselorBlockedStaffPath(pathname)) {
    return response;
  }

  if (!isCounselorRole(role)) {
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = "/dashboard/counselor";
  return withDeployHeaders(NextResponse.redirect(url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
