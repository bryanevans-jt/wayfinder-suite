"use client";

import { createClient } from "@wayfinder/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { friendlyAuthError, accountNotSetUpMessage } from "@wayfinder/supabase/error-log";
import Link from "next/link";
import { useMemo, useState } from "react";

type LoginFormProps = {
  /** Public product name (e.g. Wayfinder, Wayfinder Pro). */
  productName: string;
  /** Optional role hint under the product name (e.g. Client). */
  variantLabel?: string;
  /** Staff login should not auto-create client accounts. */
  shouldCreateUser?: boolean;
  /** When true, only emails already in Supabase Auth can request a magic link. */
  requireExistingAccount?: boolean;
  /** Google Workspace domain hint (e.g. thejoshuatree.org). Shows Google sign-in when set. */
  googleHostedDomain?: string;
  /** Link to Terms of Use (shown above sign-in actions). */
  termsHref?: string;
  /** Where to send the browser after passkey sign-in succeeds. */
  redirectAfterSignIn?: string;
  /** Override Supabase browser client (e.g. reports host-only auth cookies). */
  createSupabaseClient?: () => SupabaseClient;
};

function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function LoginForm({
  productName,
  variantLabel,
  shouldCreateUser = false,
  requireExistingAccount = true,
  googleHostedDomain,
  termsHref,
  redirectAfterSignIn = "/dashboard",
  createSupabaseClient = createClient,
}: LoginFormProps) {
  const supabase = useMemo(() => createSupabaseClient(), [createSupabaseClient]);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<null | "magic" | "passkey" | "google">(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!email.trim()) {
      setNotice("Enter your email address.");
      return;
    }
    setBusy("magic");
    const origin = window.location.origin;
    /** Keep this an exact path Supabase can allowlist (`/auth/callback` only — no `?next=`). */
    const emailRedirectTo = `${origin}/auth/callback`;

    if (requireExistingAccount) {
      try {
        const checkRes = await fetch("/api/auth/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (checkRes.status === 404) {
          setBusy(null);
          setNotice(accountNotSetUpMessage(productName));
          return;
        }
        if (!checkRes.ok) {
          setBusy(null);
          setNotice("We could not verify this email. Please try again in a moment.");
          return;
        }
      } catch {
        setBusy(null);
        setNotice("We could not verify this email. Please try again in a moment.");
        return;
      }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: requireExistingAccount ? false : shouldCreateUser,
        emailRedirectTo,
      },
    });
    setBusy(null);
    if (error) {
      setNotice(
        friendlyAuthError(error.message, emailRedirectTo, productName)
      );
      return;
    }
    setNotice(
      `Check your email for the ${productName} sign-in link. If nothing arrives within a minute, check your spam folder.`
    );
  }

  async function signInWithGoogle() {
    setNotice(null);
    setBusy("google");
    const origin = window.location.origin;
    const redirectTo = `${origin}/auth/callback`;

    const queryParams: Record<string, string> = {
      access_type: "online",
      prompt: "select_account",
    };
    if (googleHostedDomain) {
      queryParams.hd = googleHostedDomain;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams,
      },
    });
    setBusy(null);
    if (error) {
      setNotice(friendlyAuthError(error.message, redirectTo, productName));
    }
  }

  async function signInWithPasskey() {
    setNotice(null);
    setBusy("passkey");
    const { data, error } = await supabase.auth.signInWithPasskey();
    setBusy(null);
    if (error) {
      setNotice(friendlyAuthError(error.message));
      return;
    }
    if (data?.session) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessionError) {
        setNotice(friendlyAuthError(sessionError.message));
        return;
      }
      window.location.assign(redirectAfterSignIn);
      return;
    }
    setNotice(
      "Passkey sign-in did not complete on this site. Use the magic link for this browser, or sign in to Wayfinder Pro first and open reporting from there."
    );
  }

  const showGoogle = Boolean(googleHostedDomain);

  return (
    <div className="w-full max-w-md space-y-8 rounded-2xl border border-brand-green/25 bg-brand-white p-8 shadow-lg">
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-green">
          {productName}
          {variantLabel ? ` · ${variantLabel}` : ""}
        </p>
        <h1 className="text-2xl font-semibold text-brand-green">Sign in</h1>
        <p className="text-sm text-brand-black/80">
          {showGoogle
            ? "Google, magic link, or passkey — zero passwords stored here."
            : "Magic link or passkey — zero passwords stored here."}
        </p>
      </header>

      {termsHref ? (
        <p className="text-center text-xs leading-relaxed text-brand-black/65">
          By signing in, you agree to our{" "}
          <Link
            href={termsHref}
            className="font-medium text-brand-green underline underline-offset-2"
          >
            Terms of Use
          </Link>
          .
        </p>
      ) : null}

      {showGoogle ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            disabled={busy !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-brand-black/20 bg-brand-white px-4 py-2.5 text-sm font-semibold text-brand-black shadow-sm hover:bg-brand-black/[0.03] disabled:opacity-60"
          >
            <GoogleMark />
            {busy === "google" ? "Redirecting…" : "Sign in with Google"}
          </button>
          <p className="text-center text-xs text-brand-black/60">
            For <strong>@{googleHostedDomain}</strong> team accounts. Counselors and others: use
            your assigned email with the magic link below.
          </p>
        </div>
      ) : null}

      {showGoogle ? (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-brand-black/15" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide">
            <span className="bg-brand-white px-2 text-brand-black/60">or use email</span>
          </div>
        </div>
      ) : null}

      <form onSubmit={sendMagicLink} className="space-y-4">
        <label className="block text-sm font-medium text-brand-black">
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand-black/20 bg-brand-white px-3 py-2 text-brand-black outline-none ring-brand-green/40 transition focus:ring-2"
            placeholder={showGoogle ? `you@${googleHostedDomain}` : "you@example.com"}
            disabled={busy !== null}
          />
        </label>
        <button
          type="submit"
          disabled={busy !== null}
          className="w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-brand-white shadow hover:bg-brand-green/90 disabled:opacity-60"
        >
          {busy === "magic" ? "Sending…" : "Email me a magic link"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-brand-black/15" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-wide">
          <span className="bg-brand-white px-2 text-brand-black/60">or</span>
        </div>
      </div>

      <button
        type="button"
        onClick={signInWithPasskey}
        disabled={busy !== null}
        className="w-full rounded-lg border border-brand-black/25 bg-brand-white px-4 py-2.5 text-sm font-semibold text-brand-black hover:bg-brand-black/[0.03] disabled:opacity-60"
      >
        {busy === "passkey" ? "Waiting for passkey…" : "Sign in with passkey"}
      </button>

      {notice ? (
        <p className="rounded-lg bg-brand-black/5 px-3 py-2 text-center text-sm text-brand-black">
          {notice}
        </p>
      ) : null}
    </div>
  );
}

export function RegisterPasskeyButton() {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onRegister() {
    setStatus(null);
    setLoading(true);
    const { error } = await supabase.auth.registerPasskey();
    setLoading(false);
    if (error) {
      setStatus(friendlyAuthError(error.message));
      return;
    }
    setStatus("Passkey registered for this device.");
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onRegister}
        disabled={loading}
        className="rounded-lg border border-brand-green/40 bg-brand-white px-4 py-2 text-sm font-medium text-brand-black hover:bg-brand-black/[0.03] disabled:opacity-60"
      >
        {loading ? "Registering…" : "Register a passkey on this device"}
      </button>
      {status ? (
        <p className="text-xs text-brand-black/80">{status}</p>
      ) : null}
    </div>
  );
}
