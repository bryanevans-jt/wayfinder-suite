import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

/** Service-role client. Prefer schema-qualified helpers for rendezvous tables. */
export function createAdminClient() {
  return createServiceRoleClient();
}

/**
 * PostgREST schema targeting for the rendezvous schema.
 * Requires `rendezvous` in Supabase API Exposed schemas (see SETUP.md).
 */
export function rendezvousSchema(admin: ReturnType<typeof createAdminClient>) {
  return admin.schema("rendezvous");
}
