import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

export type ContactLogEventKind = "created" | "corrected" | "admin_edited" | "deleted";

type ContactLogSnapshot = {
  public_outcome?: string | null;
  notes?: string | null;
};

export async function recordContactLogEvent(
  admin: AdminClient,
  input: {
    contactLogId?: string | null;
    clientId: string;
    actorUserId: string;
    eventKind: ContactLogEventKind;
    before?: ContactLogSnapshot | null;
    after?: ContactLogSnapshot | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const row = {
    contact_log_id: input.contactLogId ?? null,
    client_id: input.clientId,
    actor_user_id: input.actorUserId,
    event_kind: input.eventKind,
    before_public_outcome: input.before?.public_outcome ?? null,
    after_public_outcome: input.after?.public_outcome ?? null,
    before_notes: input.before?.notes ?? null,
    after_notes: input.after?.notes ?? null,
    metadata: input.metadata ?? {},
  };

  const { error } = await admin.from("contact_log_events").insert(row);
  if (error) {
    console.error("[contact-log-events] failed to record:", error.message);
  }
}
