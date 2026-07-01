import { APP_VERSION } from "@wayfinder/branding";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    googleOAuth: Boolean(
      process.env.GOOGLE_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
        process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    ),
  };

  const ok = checks.supabaseUrl && checks.supabaseAnonKey && checks.serviceRoleKey;

  return NextResponse.json(
    {
      ok,
      app: "wayfinder-reports",
      version: APP_VERSION,
      checks,
    },
    { status: ok ? 200 : 503 }
  );
}
