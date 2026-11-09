import { NextResponse } from "next/server";

export async function GET() {
  const googleSa = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
  return NextResponse.json({
    ok: true,
    app: "rendezvous",
    googleServiceAccount: googleSa,
    emailsEnabled: process.env.RENDEZVOUS_EMAILS_ENABLED === "true",
  });
}
