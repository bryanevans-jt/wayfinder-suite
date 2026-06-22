import type { createServiceRoleClient } from "./admin-server";
import { isEsReplyOverdue } from "./business-hours";
import { notifySupervisorsForEs } from "./notify-user";

export type MessageSlaNotifyResult = {
  scanned: number;
  notified: number;
  skipped: number;
};

/** Notify supervisors when an ES has not replied within the 48 business-hour SLA. */
export async function processOverdueMessageSla(
  admin: ReturnType<typeof createServiceRoleClient>
): Promise<MessageSlaNotifyResult> {
  const { data: threads, error } = await admin
    .from("client_message_threads")
    .select("id, client_id, client_label, current_es_user_id, last_client_message_at, last_es_message_at")
    .not("last_client_message_at", "is", null)
    .not("current_es_user_id", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  let notified = 0;
  let skipped = 0;

  for (const thread of threads ?? []) {
    const lastClientAt = thread.last_client_message_at as string;
    const lastEsAt = (thread.last_es_message_at as string | null) ?? null;
    const esUserId = thread.current_es_user_id as string;
    const threadId = thread.id as string;

    if (!isEsReplyOverdue(lastClientAt, lastEsAt)) {
      skipped++;
      continue;
    }

    const { data: existing } = await admin
      .from("in_app_notifications")
      .select("id")
      .eq("kind", "message_sla_overdue")
      .contains("metadata", {
        thread_id: threadId,
        last_client_message_at: lastClientAt,
      })
      .limit(1);

    if (existing?.length) {
      skipped++;
      continue;
    }

    let clientLabel = (thread.client_label as string | null) ?? "a client";
    if (!thread.client_label && thread.client_id) {
      const { data: clientRow } = await admin
        .from("clients")
        .select("contact_email")
        .eq("id", thread.client_id as string)
        .maybeSingle();
      clientLabel = (clientRow?.contact_email as string | null) ?? clientLabel;
    }

    const { data: esProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", esUserId)
      .maybeSingle();
    const esName = (esProfile?.full_name as string | null) ?? "Employment Specialist";

    await notifySupervisorsForEs(admin, esUserId, {
      kind: "message_sla_overdue",
      title: "Client message needs a reply",
      body: `${esName} has not replied to ${clientLabel} within 48 business hours.`,
      link_path: "/dashboard/messages",
      metadata: {
        thread_id: threadId,
        last_client_message_at: lastClientAt,
        client_label: clientLabel,
        es_user_id: esUserId,
      },
      app: "staff",
    });

    notified++;
  }

  return {
    scanned: threads?.length ?? 0,
    notified,
    skipped,
  };
}
