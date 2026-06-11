import webpush from "web-push";
import type { createServiceRoleClient } from "./admin-server";

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function staffAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_STAFF_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function clientAppOrigin(): string {
  return (process.env.NEXT_PUBLIC_CLIENT_APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (!isWebPushConfigured()) {
    return false;
  }
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    vapidConfigured = true;
  }
  return true;
}

export type NotifyUserInput = {
  userId: string;
  kind: string;
  title: string;
  body?: string | null;
  link_path?: string | null;
  metadata?: Record<string, unknown>;
  /** Which app the recipient should open when they click the push. */
  app: "staff" | "client";
};

export async function sendWebPushToUser(
  admin: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  payload: { title: string; body?: string | null; url: string }
): Promise<{ sent: number; failed: number }> {
  if (!ensureVapid()) {
    return { sent: 0, failed: 0 };
  }

  const { data: subs, error } = await admin
    .from("push_notification_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId);

  if (error || !subs?.length) {
    return { sent: 0, failed: 0 };
  }

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url,
  });

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        },
        body
      );
      sent++;
    } catch (err: unknown) {
      failed++;
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        staleIds.push(sub.id);
      }
    }
  }

  if (staleIds.length > 0) {
    await admin.from("push_notification_subscriptions").delete().in("id", staleIds);
  }

  return { sent, failed };
}

/** Insert in-app notification and send Web Push when configured. */
export async function notifyUser(
  admin: ReturnType<typeof createServiceRoleClient>,
  input: NotifyUserInput
): Promise<void> {
  const { error } = await admin.from("in_app_notifications").insert({
    user_id: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body ?? null,
    link_path: input.link_path ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    console.error("notifyUser in_app insert failed:", error.message);
    return;
  }

  const origin = input.app === "staff" ? staffAppOrigin() : clientAppOrigin();
  const path = input.link_path?.startsWith("/") ? input.link_path : "/dashboard";
  const url = `${origin}${path}`;

  try {
    await sendWebPushToUser(admin, input.userId, {
      title: input.title,
      body: input.body,
      url,
    });
  } catch (err) {
    console.error("notifyUser web push failed:", err);
  }
}
