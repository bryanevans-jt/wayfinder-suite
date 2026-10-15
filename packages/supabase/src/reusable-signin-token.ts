import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export function hashReusableSignInToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}

export function generateReusableSignInTokenPlain(): string {
  return randomBytes(32).toString("base64url");
}

/** Default 7 days; cap at 30 via env STAFF_REUSABLE_SIGNIN_DAYS. */
export function reusableSignInTtlDays(): number {
  const raw = (process.env.STAFF_REUSABLE_SIGNIN_DAYS ?? "7").trim();
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(n, 30);
}

export type IssuedReusableSignInToken = {
  plainToken: string;
  expiresAt: string;
  ttlDays: number;
};

export async function issueReusableSignInToken(
  admin: SupabaseClient,
  opts: { authUserId: string; email: string }
): Promise<IssuedReusableSignInToken> {
  const authUserId = opts.authUserId.trim();
  const email = opts.email.trim().toLowerCase();
  if (!authUserId || !email.includes("@")) {
    throw new Error("authUserId and email are required");
  }

  const plainToken = generateReusableSignInTokenPlain();
  const tokenHash = hashReusableSignInToken(plainToken);
  const ttlDays = reusableSignInTtlDays();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

  await admin.from("staff_reusable_signin_tokens").delete().eq("auth_user_id", authUserId);

  const { error } = await admin.from("staff_reusable_signin_tokens").insert({
    token_hash: tokenHash,
    auth_user_id: authUserId,
    email,
    expires_at: expiresAt,
  });

  if (error) {
    if (/does not exist|Could not find the table/i.test(error.message)) {
      throw new Error(
        "Reusable sign-in is not available until migration staff_reusable_signin_tokens is applied."
      );
    }
    throw new Error(error.message);
  }

  return { plainToken, expiresAt, ttlDays };
}

export type ResolvedReusableSignInToken = {
  authUserId: string;
  email: string;
  expiresAt: string;
};

export async function resolveReusableSignInToken(
  admin: SupabaseClient,
  plainToken: string
): Promise<ResolvedReusableSignInToken | null> {
  const trimmed = plainToken.trim();
  if (!trimmed) return null;

  const tokenHash = hashReusableSignInToken(trimmed);
  const { data, error } = await admin
    .from("staff_reusable_signin_tokens")
    .select("auth_user_id, email, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error?.message && /does not exist|Could not find the table/i.test(error.message)) {
    return null;
  }
  if (error || !data) return null;

  const expiresAt = data.expires_at as string;
  if (new Date(expiresAt).getTime() <= Date.now()) {
    return null;
  }

  await admin
    .from("staff_reusable_signin_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash);

  return {
    authUserId: data.auth_user_id as string,
    email: (data.email as string).trim().toLowerCase(),
    expiresAt,
  };
}
