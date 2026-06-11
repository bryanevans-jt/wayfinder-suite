"use client";

import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}

type Status = "loading" | "unconfigured" | "unsupported" | "denied" | "off" | "on" | "busy";

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
    if (!publicKey) {
      setStatus("unconfigured");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (reg?.pushManager) {
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    } else {
      setStatus("off");
    }
  }, [publicKey]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const enable = useCallback(async () => {
    if (!publicKey) return;
    setStatus("busy");
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "off");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const json = subscription.toJSON();
      const res = await fetch(subscribePath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys?.p256dh,
          auth: json.keys?.auth,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
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
            disabled={status === "busy"}
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
