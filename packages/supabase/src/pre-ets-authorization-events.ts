import type { SupabaseClient } from "@supabase/supabase-js";

export type PreEtsAuthorizationEventKind =
  | "auth_number_changed"
  | "roster_students_changed";

export async function insertPreEtsAuthorizationEvent(
  admin: SupabaseClient,
  input: {
    authorizationId: string;
    actorUserId?: string | null;
    eventKind: PreEtsAuthorizationEventKind;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await admin.from("pre_ets_authorization_events").insert({
    authorization_id: input.authorizationId,
    actor_user_id: input.actorUserId ?? null,
    event_kind: input.eventKind,
    metadata: input.metadata ?? {},
  });
}
