"use client";

import { friendlyClientError } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";
import {
  enablePushNotifications,
  getPushSubscriptionStatus,
  type PushSubscriptionStatus,
} from "./push-notifications-utils";

const DISMISS_KEY = "wayfinder-push-prompt-dismissed";

type Props = {
  subscribePath?: string;
  className?: string;
};

export function PushNotificationPrompt({
  subscribePath = "/api/push/subscribe",
  className = "",
}: Props) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [status, setStatus] = useState<PushSubscriptionStatus | "loading" | "dismissed">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1") {
      setStatus("dismissed");
      return;
    }
    setStatus(await getPushSubscriptionStatus(publicKey));
  }, [publicKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    setStatus("dismissed");
  }, []);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setBusy(true);
    setError(null);
    try {
      await enablePushNotifications(publicKey, subscribePath);
      setStatus("on");
    } catch (err) {
      setError(friendlyClientError(err));
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [publicKey, subscribePath, refresh]);

  if (
    status === "loading" ||
    status === "dismissed" ||
    status === "unconfigured" ||
    status === "unsupported" ||
    status === "denied" ||
    status === "on"
  ) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border border-brand-green/30 bg-brand-green/5 px-4 py-3 ${className}`}
      role="status"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-brand-black">Turn on push notifications</p>
          <p className="text-xs text-brand-black/65">
            Get alerts for messages, meetings, and timesheet updates without keeping this tab open.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void enable()}
            className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-green/90 disabled:opacity-50"
          >
            {busy ? "Enabling…" : "Enable"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={dismiss}
            className="rounded-lg px-2 py-1.5 text-xs text-brand-black/60 hover:text-brand-black disabled:opacity-50"
          >
            Not now
          </button>
        </div>
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
