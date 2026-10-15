"use client";

import { STAFF_APP_PRODUCT_NAME } from "@wayfinder/branding";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

/** Multi-use counselor sign-in — session is created via POST (mail scanners won't burn the link). */
export function AuthAccessClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-white px-4 py-16">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-brand-black/10 bg-brand-white px-6 py-8 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-brand-black">Sign in to {STAFF_APP_PRODUCT_NAME}</h1>
        {token ? (
          <>
            <p className="text-sm leading-relaxed text-brand-black/80">
              Tap <strong>Continue</strong> to finish signing in. This link can be used more than once
              until it expires — safe if your agency email system previewed the message.
            </p>
            <form method="POST" action="/api/auth/redeem-access-token" className="space-y-3">
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                className="w-full rounded-lg bg-brand-green px-4 py-3 text-sm font-semibold text-white hover:opacity-95"
              >
                Continue to {STAFF_APP_PRODUCT_NAME}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-brand-black/80">
              This sign-in link is incomplete. Request a new link from the login page.
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
