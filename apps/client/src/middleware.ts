import { wayfinderAuthMiddleware } from "@wayfinder/supabase/middleware-app";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return wayfinderAuthMiddleware(request, { app: "client" });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
