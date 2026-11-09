import { googlePrivateKeyLooksValid } from "@/lib/google/credentials";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

function jwtRef(token: string | undefined): string | null {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const json = JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as {
      ref?: string;
    };
    return typeof json.ref === "string" ? json.ref : null;
  } catch {
    return null;
  }
}

function urlProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.split(".")[0] || null;
  } catch {
    return null;
  }
}

export async function GET() {
  const googleSaConfigured = Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
  const googlePrivateKeyValid = googlePrivateKeyLooksValid();
  const googleSa = googleSaConfigured && googlePrivateKeyValid;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const urlRef = urlProjectRef(supabaseUrl);
  const anonRef = jwtRef(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const serviceRef = jwtRef(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKeyMatchesUrl = Boolean(urlRef && anonRef && urlRef === anonRef);
  const serviceRoleKeyMatchesUrl = Boolean(urlRef && serviceRef && urlRef === serviceRef);

  let supabaseAdminOk = false;
  let supabaseAdminError: string | undefined;
  if (serviceRoleKeyMatchesUrl) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("profiles").select("id").limit(1);
      if (error) {
        supabaseAdminError = error.message.slice(0, 160);
      } else {
        supabaseAdminOk = true;
      }
    } catch (err) {
      supabaseAdminError = err instanceof Error ? err.message.slice(0, 160) : "admin_client_failed";
    }
  } else if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseAdminError = "missing_service_role_key";
  } else {
    supabaseAdminError = "service_role_key_project_mismatch";
  }

  const ok = googleSa && anonKeyMatchesUrl && serviceRoleKeyMatchesUrl && supabaseAdminOk;

  return NextResponse.json({
    ok,
    app: "rendezvous",
    googleServiceAccount: googleSa,
    googleServiceAccountConfigured: googleSaConfigured,
    googlePrivateKeyValid,
    emailsEnabled: process.env.RENDEZVOUS_EMAILS_ENABLED === "true",
    supabase: {
      urlProjectRef: urlRef,
      anonKeyMatchesUrl,
      serviceRoleKeyMatchesUrl,
      adminOk: supabaseAdminOk,
      ...(supabaseAdminError ? { adminError: supabaseAdminError } : {}),
    },
  });
}
