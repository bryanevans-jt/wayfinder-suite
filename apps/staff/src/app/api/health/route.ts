import { APP_VERSION } from "@wayfinder/branding";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Deploy verification — compare `version` after each production push. */
export async function GET() {
  const checks: Record<string, boolean> = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };

  const ok = checks.supabaseUrl && checks.supabaseAnonKey && checks.serviceRoleKey;

  return NextResponse.json(
    {
      ok,
      app: "wayfinder-pro",
      version: APP_VERSION,
      gitCommit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      checks,
    },
    { status: ok ? 200 : 503 }
  );
}
