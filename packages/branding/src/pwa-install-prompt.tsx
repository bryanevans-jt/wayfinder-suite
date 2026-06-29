"use client";

import { useEffect, useState } from "react";

export type PwaInstallPromptProps = {
  /** Shown in the install banner (e.g. "Wayfinder Pro"). */
  productName?: string;
  /** localStorage key so dismiss is per-app. */
  storageKey?: string;
};

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 768px)").matches;
}

export function PwaInstallPrompt({
  productName = "Wayfinder",
  storageKey = "wayfinder-pwa-install-dismissed",
}: PwaInstallPromptProps) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) return;
    if (window.localStorage.getItem(storageKey) === "1") {
      setDismissed(true);
      return;
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    if (isIosDevice() && isMobileViewport()) {
      setShowIosHint(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, [storageKey]);

  function dismiss() {
    setDismissed(true);
    setShowIosHint(false);
    setDeferred(null);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
  }

  if (dismissed) return null;

  if (deferred) {
    return (
      <div className="mb-4 rounded-lg border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-sm">
        <p className="font-medium text-brand-black">Add {productName} to your home screen</p>
        <p className="mt-1 text-brand-black/70">Quick access on mobile — works like an app.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-white"
            onClick={async () => {
              await deferred.prompt();
              dismiss();
            }}
          >
            Install
          </button>
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
            onClick={dismiss}
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  if (!showIosHint) return null;

  return (
    <div className="mb-4 rounded-lg border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-sm">
      <p className="font-medium text-brand-black">Add {productName} to your home screen</p>
      <p className="mt-1 text-brand-black/70">
        On iPhone or iPad: tap <span className="font-semibold">Share</span> in Safari, then{" "}
        <span className="font-semibold">Add to Home Screen</span>.
      </p>
      <button
        type="button"
        className="mt-3 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
        onClick={dismiss}
      >
        Got it
      </button>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
