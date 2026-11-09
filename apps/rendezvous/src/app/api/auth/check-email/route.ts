import { NextResponse } from "next/server";
import { JOSHUA_TREE_ORG_EMAIL_DOMAIN } from "@wayfinder/branding";

/** Lightweight pre-check used by shared LoginForm patterns. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase() ?? "";
  const ok = email.endsWith(`@${JOSHUA_TREE_ORG_EMAIL_DOMAIN}`);
  return NextResponse.json({ ok, orgOnly: true });
}
