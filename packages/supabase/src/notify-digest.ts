import type { createServiceRoleClient } from "./admin-server";
import { notifyUser, type NotifyUserInput } from "./notify-user";

const MAX_BODY_LINES = 12;

type DigestBucket = {
  userId: string;
  kind: string;
  app: "staff" | "client";
  items: Array<{
    title: string;
    body?: string | null;
    link_path?: string | null;
    metadata?: Record<string, unknown>;
  }>;
};

function bucketKey(userId: string, kind: string): string {
  return `${userId}\0${kind}`;
}

function itemDedupeKey(item: DigestBucket["items"][number]): string {
  const meta = item.metadata ?? {};
  const id =
    meta.clientId ??
    meta.thread_id ??
    meta.hospitality_task_id ??
    meta.sessionId ??
    item.link_path ??
    item.title;
  return String(id);
}

function dedupeItems(items: DigestBucket["items"]): DigestBucket["items"] {
  const seen = new Set<string>();
  const out: DigestBucket["items"] = [];
  for (const item of items) {
    const key = itemDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function lineForItem(item: DigestBucket["items"][number]): string {
  const body = item.body?.trim();
  if (body) return body;
  const title = item.title.trim();
  const billPrefix = "Bill intake: ";
  if (title.startsWith(billPrefix)) return title.slice(billPrefix.length);
  const referralPrefix = "Referral follow-up: ";
  if (title.startsWith(referralPrefix)) return title.slice(referralPrefix.length);
  const missingPrefix = "Missing SE Monthly report — ";
  if (title.startsWith(missingPrefix)) return title.slice(missingPrefix.length);
  const overduePrefix = "Overdue SE Monthly report — ";
  if (title.startsWith(overduePrefix)) return title.slice(overduePrefix.length);
  return title;
}

function defaultLinkForKind(kind: string, items: DigestBucket["items"]): string | null {
  const first = items.find((i) => i.link_path?.startsWith("/"))?.link_path ?? null;
  if (first) return first;
  switch (kind) {
    case "referral_intake_billing":
      return "/dashboard/intake-billing";
    case "report_missing":
    case "report_overdue":
      return "/dashboard/reporting";
    case "referral_sla":
      return "/dashboard/referrals";
    case "message_sla_overdue":
      return "/dashboard/messages";
    case "pre_ets_compliance":
      return "/dashboard/pre-ets";
    case "intake_meeting_overdue":
      return "/dashboard/intake/calls";
    default:
      return null;
  }
}

function digestTitle(kind: string, count: number): string {
  switch (kind) {
    case "referral_intake_billing":
      return `Bill intake: ${count} clients ready`;
    case "intake_meeting_overdue":
      return `Intake follow-up needed (${count})`;
    case "report_missing":
      return `Missing SE Monthly reports (${count})`;
    case "report_overdue":
      return `Overdue SE Monthly reports (${count})`;
    case "referral_sla":
      return `Referral follow-up (${count})`;
    case "message_sla_overdue":
      return `Client messages need replies (${count})`;
    case "pre_ets_compliance":
      return `Pre-ETS documentation overdue (${count})`;
    case "counselor_possible_duplicate":
      return `Possible duplicate counselors (${count})`;
    default:
      return `${count} notifications`;
  }
}

function buildDigestBody(items: DigestBucket["items"]): string {
  const lines = items.map(lineForItem);
  if (lines.length <= MAX_BODY_LINES) {
    return lines.map((l) => `• ${l}`).join("\n");
  }
  const shown = lines.slice(0, MAX_BODY_LINES);
  const rest = lines.length - MAX_BODY_LINES;
  return `${shown.map((l) => `• ${l}`).join("\n")}\n• …and ${rest} more`;
}

function buildDigestMetadata(kind: string, items: DigestBucket["items"]): Record<string, unknown> {
  const clientIds = [
    ...new Set(
      items
        .map((i) => i.metadata?.clientId)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  const threadIds = [
    ...new Set(
      items
        .map((i) => i.metadata?.thread_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  return {
    digest: true,
    digest_kind: kind,
    count: items.length,
    ...(clientIds.length ? { clientIds } : {}),
    ...(threadIds.length ? { threadIds } : {}),
  };
}

export type NotificationDigestBuffer = {
  enqueue: (input: NotifyUserInput) => void;
  flush: (admin: ReturnType<typeof createServiceRoleClient>) => Promise<void>;
};

/** Batch multiple notifications per user/kind into one digest on flush. */
export function createNotificationDigestBuffer(): NotificationDigestBuffer {
  const map = new Map<string, DigestBucket>();

  return {
    enqueue(input: NotifyUserInput) {
      const key = bucketKey(input.userId, input.kind);
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          userId: input.userId,
          kind: input.kind,
          app: input.app,
          items: [],
        };
        map.set(key, bucket);
      }
      bucket.items.push({
        title: input.title,
        body: input.body,
        link_path: input.link_path,
        metadata: input.metadata,
      });
    },

    async flush(admin) {
      for (const bucket of map.values()) {
        const items = dedupeItems(bucket.items);
        if (items.length === 0) continue;

        if (items.length === 1) {
          const one = items[0]!;
          await notifyUser(admin, {
            userId: bucket.userId,
            kind: bucket.kind,
            app: bucket.app,
            title: one.title,
            body: one.body,
            link_path: one.link_path,
            metadata: one.metadata,
          });
          continue;
        }

        await notifyUser(admin, {
          userId: bucket.userId,
          kind: bucket.kind,
          app: bucket.app,
          title: digestTitle(bucket.kind, items.length),
          body: buildDigestBody(items),
          link_path: defaultLinkForKind(bucket.kind, items),
          metadata: buildDigestMetadata(bucket.kind, items),
        });
      }
      map.clear();
    },
  };
}
