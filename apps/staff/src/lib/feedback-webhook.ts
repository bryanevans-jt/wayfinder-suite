/**
 * Server-only Radar webhook for new feedback submissions.
 * Never import this module from client components.
 */

import type { FeedbackType } from "./feedback";

export const FEEDBACK_WEBHOOK_TIMEOUT_MS = 15_000;
export const FEEDBACK_WEBHOOK_MAX_ATTEMPTS = 2;
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

export type FeedbackWebhookLog = (message: string, detail?: unknown) => void;

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
  const staffAppUrl =
    readEnvOverride(env.staffAppUrl, process.env.NEXT_PUBLIC_STAFF_APP_URL)?.replace(
      /\/$/,
      ""
    ) || null;
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

/** Host-only label for logs — never the full webhook URL or key. */
export function feedbackWebhookHostLabel(url: string): string {
  try {
    return new URL(url).host || "webhook-host";
  } catch {
    return "webhook-host";
  }
}

export function isRetriableFeedbackWebhookFailure(opts: {
  status?: number | null;
  error?: unknown;
}): boolean {
  if (opts.status != null && opts.status >= 500) return true;
  const err = opts.error;
  if (!err) return false;
  if (err instanceof Error) {
    const name = err.name.toLowerCase();
    const message = err.message.toLowerCase();
    if (name.includes("abort") || message.includes("aborted")) return true;
    if (message.includes("timeout") || message.includes("timed out")) return true;
  }
  return false;
}

async function postFeedbackWebhookOnce(opts: {
  url: string;
  auth: { name: string; value: string };
  payload: FeedbackWebhookPayload;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}): Promise<{ ok: boolean; status: number | null; bodyPreview: string; error?: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  try {
    const res = await opts.fetchImpl(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [opts.auth.name]: opts.auth.value,
      },
      body: JSON.stringify(opts.payload),
      signal: controller.signal,
    });
    const bodyPreview = (await res.text().catch(() => "")).slice(0, 200);
    return { ok: res.ok, status: res.status, bodyPreview };
  } catch (error) {
    return { ok: false, status: null, bodyPreview: "", error };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Deliver feedback to Radar. Never throws for missing config or HTTP failures —
 * logs instead. Retries once on timeout/abort or 5xx.
 * Prefer scheduling via Next.js `after()` so the serverless response can return
 * quickly without aborting the POST.
 */
export async function notifyFeedbackWebhook(
  payload: FeedbackWebhookPayload,
  opts?: {
    fetchImpl?: typeof fetch;
    env?: FeedbackWebhookEnv;
    timeoutMs?: number;
    maxAttempts?: number;
    log?: FeedbackWebhookLog;
  }
): Promise<{ sent: boolean; skipped?: string; error?: string; attempts?: number }> {
  const log =
    opts?.log ??
    ((message, detail) => {
      if (detail === undefined) console.error(message);
      else console.error(message, detail);
    });
  const config = resolveFeedbackWebhookConfig(opts?.env);
  if (!config.url) {
    return { sent: false, skipped: "FEEDBACK_WEBHOOK_URL not set" };
  }
  if (!config.key) {
    return { sent: false, skipped: "FEEDBACK_WEBHOOK_KEY not set" };
  }

  const auth = buildFeedbackWebhookAuthHeader(config.keyHeader, config.key);
  const timeoutMs = opts?.timeoutMs ?? FEEDBACK_WEBHOOK_TIMEOUT_MS;
  const maxAttempts = opts?.maxAttempts ?? FEEDBACK_WEBHOOK_MAX_ATTEMPTS;
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const host = feedbackWebhookHostLabel(config.url);

  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await postFeedbackWebhookOnce({
      url: config.url,
      auth,
      payload,
      timeoutMs,
      fetchImpl,
    });

    if (result.ok) {
      log("feedback webhook POST ok", {
        submissionId: payload.id,
        host,
        status: result.status,
        attempt,
        bodyPreview: result.bodyPreview,
      });
      return { sent: true, attempts: attempt };
    }

    if (result.error) {
      lastError =
        result.error instanceof Error ? result.error.message : "webhook failed";
      log("feedback webhook POST error", {
        submissionId: payload.id,
        host,
        attempt,
        error: lastError,
      });
    } else {
      lastError = `HTTP ${result.status}`;
      log("feedback webhook POST failed", {
        submissionId: payload.id,
        host,
        status: result.status,
        attempt,
        bodyPreview: result.bodyPreview,
      });
    }

    const shouldRetry =
      attempt < maxAttempts &&
      isRetriableFeedbackWebhookFailure({
        status: result.status,
        error: result.error,
      });
    if (!shouldRetry) {
      return { sent: false, error: lastError, attempts: attempt };
    }
  }

  return { sent: false, error: lastError, attempts: maxAttempts };
}
