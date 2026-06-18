"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";
import {
  enablePushNotifications,
  getPushSubscriptionStatus,
  type PushSubscriptionStatus,
} from "./push-notifications-utils";

type Status = PushSubscriptionStatus | "loading" | "busy";

type Props = {
  subscribePath?: string;
  className?: string;
};

export function PushNotificationsToggle({
  subscribePath = "/api/push/subscribe",
  className = "",
}: Props) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setStatus(await getPushSubscriptionStatus(publicKey));
  }, [publicKey]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setStatus("busy");
    setError(null);
    try {
      await enablePushNotifications(publicKey, subscribePath);
      setStatus("on");
    } catch (err) {
      setError(friendlyClientError(err));
      setStatus("off");
    }
  }, [publicKey, subscribePath]);

  const disable = useCallback(async () => {
    setStatus("busy");
    setError(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch(subscribePath, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }
      setStatus("off");
    } catch (err) {
      setError(friendlyClientError(err));
      await refreshStatus();
    }
  }, [subscribePath, refreshStatus]);

  if (status === "loading" || status === "unconfigured" || status === "unsupported") {
    return null;
  }

  if (status === "denied") {
    return (
      <p className={`text-xs text-brand-black/55 ${className}`}>
        Notifications blocked in your browser settings.
      </p>
    );
  }

  return (
    <div className={className}>
      {status === "on" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-brand-green">Push notifications on</span>
          <button
            type="button"
            onClick={() => void disable()}
            className="text-xs text-brand-black/60 underline hover:text-brand-black disabled:opacity-50"
          >
            Turn off
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={status === "busy"}
          onClick={() => void enable()}
          className="w-full rounded-lg border border-brand-green/35 bg-brand-green/5 px-3 py-2 text-left text-xs font-medium text-brand-green hover:bg-brand-green/10 disabled:opacity-50"
        >
          {status === "busy" ? "Enabling…" : "Enable push notifications"}
        </button>
      )}
      {error ? <p className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
