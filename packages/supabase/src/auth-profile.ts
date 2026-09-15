import type { SupabaseClient } from "@supabase/supabase-js";
import { isKnownRole } from "./roles";

export type AuthUserProfileRow = {
  role: string;
  is_active: boolean;
};

/**
 * Load the signed-in user's profile via RPC first (avoids profiles RLS recursion),
 * matching {@link wayfinderAuthMiddleware} behavior.
 */
export async function loadAuthUserProfile(
  supabase: SupabaseClient
): Promise<{ profile: AuthUserProfileRow | null; errorMessage: string | null }> {
  const { data: rpcRows, error: rpcError } = await supabase.rpc("get_auth_user_profile");

  if (!rpcError && rpcRows) {
    const row = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as
      | { role?: string; is_active?: boolean }
      | undefined;
    if (row?.role && isKnownRole(row.role)) {
      return {
        profile: {
          role: String(row.role),
          is_active: row.is_active !== false,
        },
        errorMessage: null,
      };
    }
  }

  if (rpcError?.message.includes("recursion")) {
    return { profile: null, errorMessage: rpcError.message };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { profile: null, errorMessage: rpcError?.message ?? null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return { profile: null, errorMessage: profileError.message };
  }
  if (!profile?.role || !isKnownRole(profile.role)) {
    return { profile: null, errorMessage: rpcError?.message ?? null };
  }

  return {
    profile: {
      role: String(profile.role),
      is_active: profile.is_active !== false,
    },
    errorMessage: null,
  };
}
