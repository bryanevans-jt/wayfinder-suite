import { NextResponse } from "next/server";

/**
 * Fail-closed in production when CRON_SECRET is missing.
 * In non-production, allow unauthenticated cron for local testing.
 * Accepts Authorization: Bearer <secret> or ?secret=<secret>.
 */
export function authorizeReportsCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = request.headers.get("authorization");
  const secretParam = new URL(request.url).searchParams.get("secret");
  return authHeader === `Bearer ${secret}` || secretParam === secret;
}

export function unauthorizedCronResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
