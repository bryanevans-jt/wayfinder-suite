import { wayfinderAuthMiddleware } from "@wayfinder/supabase/middleware-app";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return wayfinderAuthMiddleware(request, { app: "client" });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/cron|api/health|favicon.ico|sw.js|manifest.json|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
};
