"use client";

import { useEffect, useState } from "react";

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!deferred || dismissed) return null;

  return (
    <div className="mb-4 rounded-lg border border-brand-green/30 bg-brand-green/5 px-4 py-3 text-sm">
      <p className="font-medium text-brand-black">Add Wayfinder to your home screen</p>
      <p className="mt-1 text-brand-black/70">Quick access on mobile — works like an app.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-brand-gold px-3 py-1.5 text-xs font-semibold text-white"
          onClick={async () => {
            await deferred.prompt();
            setDeferred(null);
          }}
        >
          Install
        </button>
        <button
          type="button"
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
          onClick={() => setDismissed(true)}
        >
          Not now
        </button>
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
