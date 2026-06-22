"use client";

import { useEffect, useState } from "react";
import {
  SUPPORT_CONTACT_EMAIL,
  SUPPORT_CONTACT_MAILTO,
  SUPPORT_CONTACT_NAME,
} from "@wayfinder/branding";
import {
  userFacingSystemErrorWithCode,
  USER_FACING_SYSTEM_ERROR,
} from "@wayfinder/supabase/error-log";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
  app: "staff" | "client";
};

export function AppErrorScreen({ error, reset, app }: Props) {
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [message, setMessage] = useState(USER_FACING_SYSTEM_ERROR);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/system-error/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            app,
            message: error.message,
            digest: error.digest ?? null,
            stack: error.stack ?? null,
          }),
        });
        const data = (await res.json()) as { errorCode?: string };
        if (!cancelled && data.errorCode) {
          setErrorCode(data.errorCode);
          setMessage(userFacingSystemErrorWithCode(data.errorCode));
        }
      } catch {
        // Keep default copy
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [app, error.digest, error.message, error.stack]);

  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-brand-black">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-sm text-brand-black/80">{message}</p>
      {errorCode ? (
        <p className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm font-semibold tracking-wide text-brand-black">
          {errorCode}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
      >
        Try again
      </button>
      <p className="mt-6 text-sm text-brand-black/70">
        Report this issue to{" "}
        <a
          href={SUPPORT_CONTACT_MAILTO}
          className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/80"
        >
          {SUPPORT_CONTACT_NAME}
        </a>{" "}
        at {SUPPORT_CONTACT_EMAIL}
        {errorCode ? ` and include reference code ${errorCode}` : ""}.
      </p>
    </main>
  );
}
