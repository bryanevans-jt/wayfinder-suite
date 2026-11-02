import {
  isCounselorRole,
  isGvraSupervisorRole,
  staffHomePath,
} from "@wayfinder/supabase";
import { wayfinderAuthMiddlewareWithContext } from "@wayfinder/supabase/middleware-app";
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
import {
  isPreEtsApiPath,
  preEtsMiddlewareAccessAllowed,
} from "@/lib/pre-ets-middleware-access";
import { isInstructorRole } from "@wayfinder/supabase/roles";
import { APP_VERSION } from "@wayfinder/branding";

function withDeployHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Wayfinder-Version", APP_VERSION);
  const sha = process.env.VERCEL_GIT_COMMIT_SHA;
  if (sha) response.headers.set("X-Wayfinder-Commit", sha.slice(0, 12));
  return response;
}

export async function middleware(request: NextRequest) {
  const auth = await wayfinderAuthMiddlewareWithContext(request, { app: "staff" });
  const response = withDeployHeaders(auth.response);

  const { pathname } = request.nextUrl;

  if (!auth.shouldContinue || !auth.effectiveRole) {
    return withDeployHeaders(response);
  }

  const role = auth.effectiveRole;

  if (isPortalPath(pathname) && !portalPathAllowedForRole(pathname, role)) {
    const url = request.nextUrl.clone();
    url.pathname = staffHomePath(role);
    return withDeployHeaders(NextResponse.redirect(url));
  }

  if (isPreEtsStaffPath(pathname) || isPreEtsApiPath(pathname)) {
    const allowed = preEtsMiddlewareAccessAllowed(role);
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
    "/((?!_next/static|_next/image|api/cron|api/health|favicon.ico|sw.js|manifest.json|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
};
