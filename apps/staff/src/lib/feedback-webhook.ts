/**
 * Server-only Radar webhook for new feedback submissions.
 * Never import this module from client components.
 */

import type { FeedbackType } from "./feedback";

export const FEEDBACK_WEBHOOK_TIMEOUT_MS = 5_000;
export const DEFAULT_FEEDBACK_WEBHOOK_KEY_HEADER = "Authorization";

export type FeedbackWebhookPayload = {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  submitter_name: string | null;
  submitter_role: string | null;
  page_url: string | null;
  created_at: string;
  admin_url: string | null;
};

export type FeedbackWebhookEnv = {
  url?: string | null;
  key?: string | null;
  keyHeader?: string | null;
  staffAppUrl?: string | null;
};

function readEnvOverride(
  override: string | null | undefined,
  processValue: string | undefined
): string | null {
  if (override !== undefined) {
    return String(override ?? "").trim() || null;
  }
  return String(processValue ?? "").trim() || null;
}

export function resolveFeedbackWebhookConfig(env: FeedbackWebhookEnv = {}): {
  url: string | null;
  key: string | null;
  keyHeader: string;
  staffAppUrl: string | null;
} {
  const url = readEnvOverride(env.url, process.env.FEEDBACK_WEBHOOK_URL);
  const key = readEnvOverride(env.key, process.env.FEEDBACK_WEBHOOK_KEY);
  const keyHeader =
    readEnvOverride(env.keyHeader, process.env.FEEDBACK_WEBHOOK_KEY_HEADER) ||
    DEFAULT_FEEDBACK_WEBHOOK_KEY_HEADER;
  const staffAppUrl = readEnvOverride(
    env.staffAppUrl,
    process.env.NEXT_PUBLIC_STAFF_APP_URL
  )?.replace(/\/$/, "") || null;
  return { url, key, keyHeader, staffAppUrl };
}

export function buildFeedbackAdminUrl(
  staffAppUrl: string | null,
  submissionId: string
): string | null {
  const base = String(staffAppUrl ?? "")
    .trim()
    .replace(/\/$/, "");
  if (!base) return null;
  return `${base}/dashboard/feedback/manage?id=${encodeURIComponent(submissionId)}`;
}

export function buildFeedbackWebhookPayload(opts: {
  id: string;
  type: FeedbackType;
  title: string;
  description: string;
  submitterName: string | null;
  submitterRole: string | null;
  pageUrl: string | null;
  createdAt: string;
  staffAppUrl: string | null;
}): FeedbackWebhookPayload {
  return {
    id: opts.id,
    type: opts.type,
    title: opts.title,
    description: opts.description,
    submitter_name: opts.submitterName,
    submitter_role: opts.submitterRole,
    page_url: opts.pageUrl,
    created_at: opts.createdAt,
    admin_url: buildFeedbackAdminUrl(opts.staffAppUrl, opts.id),
  };
}

export function buildFeedbackWebhookAuthHeader(
  keyHeader: string,
  key: string
): { name: string; value: string } {
  if (keyHeader.toLowerCase() === "authorization") {
    return { name: "Authorization", value: `Bearer ${key}` };
  }
  return { name: keyHeader, value: key };
}

/**
 * Fire-and-forget style notify. Never throws to the caller for missing config
 * or HTTP failures — logs instead. Returns whether the POST succeeded.
 */
export async function notifyFeedbackWebhook(
  payload: FeedbackWebhookPayload,
  opts?: {
    fetchImpl?: typeof fetch;
    env?: FeedbackWebhookEnv;
    timeoutMs?: number;
    log?: (message: string, detail?: unknown) => void;
  }
): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  const log = opts?.log ?? ((message, detail) => console.error(message, detail ?? ""));
  const config = resolveFeedbackWebhookConfig(opts?.env);
  if (!config.url) {
    return { sent: false, skipped: "FEEDBACK_WEBHOOK_URL not set" };
  }
  if (!config.key) {
    return { sent: false, skipped: "FEEDBACK_WEBHOOK_KEY not set" };
  }

  const auth = buildFeedbackWebhookAuthHeader(config.keyHeader, config.key);
  const timeoutMs = opts?.timeoutMs ?? FEEDBACK_WEBHOOK_TIMEOUT_MS;
  const fetchImpl = opts?.fetchImpl ?? fetch;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [auth.name]: auth.value,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        log("feedback webhook POST failed", {
          status: res.status,
          bodyPreview: text.slice(0, 200),
        });
        return { sent: false, error: `HTTP ${res.status}` };
      }
      return { sent: true };
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    log("feedback webhook POST error", err);
    return {
      sent: false,
      error: err instanceof Error ? err.message : "webhook failed",
    };
  }
}
