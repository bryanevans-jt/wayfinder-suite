import { createClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "./env";

/**
 * Server-only Supabase client using the service role key. Bypasses RLS.
 * Set `SUPABASE_SERVICE_ROLE_KEY` in the staff app environment (never expose to the browser).
 */
export function createServiceRoleClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
