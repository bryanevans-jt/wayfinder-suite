"use client";

import { STAFF_APP_PRODUCT_NAME } from "@wayfinder/branding";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

/**
 * Safe Links and other mail scanners prefetch GET /auth/callback and burn one-time OTPs.
 * Email links land here first; verification runs only after the user clicks Continue.
 */
export function AuthConfirmClient() {
  const searchParams = useSearchParams();

  const tokenHash = searchParams.get("token_hash") ?? searchParams.get("token") ?? "";
  const type = searchParams.get("type") ?? "magiclink";
  const next = searchParams.get("next") ?? "/dashboard";
  const code = searchParams.get("code") ?? "";

  const callbackHref = useMemo(() => {
    const params = new URLSearchParams();
    if (code) {
      params.set("code", code);
    } else if (tokenHash) {
      params.set("token_hash", tokenHash);
      params.set("type", type);
    }
    if (next && next.startsWith("/")) {
      params.set("next", next);
    }
    const qs = params.toString();
    return qs ? `/auth/callback?${qs}` : "";
  }, [code, tokenHash, type, next]);

  const canContinue = Boolean(code || tokenHash);

  const onContinue = useCallback(() => {
    if (!callbackHref) return;
    window.location.assign(callbackHref);
  }, [callbackHref]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-white px-4 py-16">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-brand-black/10 bg-brand-white px-6 py-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-brand-black">Finish signing in</h1>
        {canContinue ? (
          <>
            <p className="text-sm leading-relaxed text-brand-black/80">
              Tap <strong>Continue</strong> to open {STAFF_APP_PRODUCT_NAME}. This extra step helps
              agency email security scanners from using your one-time sign-in link before you do.
            </p>
            <button
              type="button"
              onClick={onContinue}
              className="w-full rounded-lg bg-brand-green px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
            >
              Continue to {STAFF_APP_PRODUCT_NAME}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-brand-black/80">
              This sign-in link is incomplete or has already been used. Request a new magic link
              from the login page.
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-brand-green underline"
            >
              Back to sign in
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
