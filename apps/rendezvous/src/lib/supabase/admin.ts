import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { createClient } from "./server";

/** Service-role client. Prefer user-scoped helpers for authenticated staff routes. */
export function createAdminClient() {
  return createServiceRoleClient();
}

/**
 * PostgREST schema targeting for the rendezvous schema.
 * Requires `rendezvous` in Supabase API Exposed schemas (see SETUP.md).
 */
export function rendezvousSchema(client: SupabaseClient) {
  return client.schema("rendezvous");
}

/**
 * Authenticated staff DB access via the caller's session + RLS
 * (`rendezvous.can_access_staff_app()`). Prefer this over the service-role
 * client for calendar/admin reads so a misconfigured service-role key cannot
 * take down staff surfaces.
 */
export async function createUserDb() {
  const supabase = await createClient();
  return {
    supabase,
    db: rendezvousSchema(supabase),
  };
}
