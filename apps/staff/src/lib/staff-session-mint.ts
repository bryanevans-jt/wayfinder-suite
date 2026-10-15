import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { createServerClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  wayfinderServerAuthOptions,
} from "@wayfinder/supabase";
import type { SupabaseCookieToSet } from "@wayfinder/supabase/cookie-types";
import { cookies } from "next/headers";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

/** Mint a browser session for this email (fresh Supabase OTP each time; not consumed from email). */
export async function mintStaffSessionCookiesForEmail(
  admin: AdminClient,
  email: string
): Promise<{ userId: string; sessionCookies: SupabaseCookieToSet[] } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) {
    return { error: "Invalid email" };
  }

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: normalized,
  });

  if (linkErr || !linkData?.properties?.hashed_token) {
    return { error: linkErr?.message ?? "Could not mint sign-in session" };
  }

  const cookieStore = await cookies();
  let sessionCookies: SupabaseCookieToSet[] = [];

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    ...wayfinderServerAuthOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        sessionCookies = cookiesToSet;
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // route handler
        }
      },
    },
  });

  const tokenHash = linkData.properties.hashed_token;
  const types = ["magiclink", "email"] as const;
  let verifyError: { message: string } | null = null;
  for (const otpType of types) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (!error) {
      verifyError = null;
      break;
    }
    verifyError = error;
  }

  if (verifyError) {
    return { error: verifyError.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { error: "Sign-in did not complete" };
  }

  return { userId: user.id, sessionCookies };
}
