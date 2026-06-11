"use client";

import { createClient } from "@wayfinder/supabase/client";
import { friendlyAuthError } from "@wayfinder/supabase/error-log";
import { useMemo, useState } from "react";

type LoginFormProps = {
  /** Public product name (e.g. Wayfinder, Wayfinder Pro). */
  productName: string;
  /** Optional role hint under the product name (e.g. Client). */
  variantLabel?: string;
  /** Staff login should not auto-create client accounts. */
  shouldCreateUser?: boolean;
};

export function LoginForm({
  productName,
  variantLabel,
  shouldCreateUser = true,
}: LoginFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [busy, setBusy] = useState<null | "magic" | "passkey" | "otp">(null);
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

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser,
        emailRedirectTo,
      },
    });
    setBusy(null);
    if (error) {
      setNotice(
        friendlyAuthError(error.message, emailRedirectTo)
      );
      return;
    }
    setNotice(
      `Check your email for the ${productName} sign-in link. If nothing arrives within a minute, check spam and confirm Supabase email (SMTP) is configured for your project.`
    );
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
      window.location.assign("/dashboard");
    }
  }

  /** When SMTP is unavailable, use `email_otp` from Supabase admin generate_link. */
  async function signInWithAdminOtp(e: React.FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (!email.trim() || !otpCode.trim()) {
      setNotice("Enter your email and the one-time code from generate_link.");
      return;
    }
    setBusy("otp");
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: "email",
    });
    setBusy(null);
    if (error) {
      setNotice(friendlyAuthError(error.message));
      return;
    }
    if (data?.session) {
      window.location.assign("/dashboard");
      return;
    }
    setNotice("Code accepted but no session was created. Generate a fresh code and try again.");
  }

  return (
    <div className="w-full max-w-md space-y-8 rounded-2xl border border-brand-green/25 bg-brand-white p-8 shadow-lg">
      <header className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-green">
          {productName}
          {variantLabel ? ` · ${variantLabel}` : ""}
        </p>
        <h1 className="text-2xl font-semibold text-brand-green">Sign in</h1>
        <p className="text-sm text-brand-black/80">
          Magic link or passkey — zero passwords stored here.
        </p>
      </header>

      <form onSubmit={sendMagicLink} className="space-y-4">
        <label className="block text-sm font-medium text-brand-black">
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-brand-black/20 bg-brand-white px-3 py-2 text-brand-black outline-none ring-brand-green/40 transition focus:ring-2"
            placeholder="you@example.com"
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

      <details className="rounded-lg border border-brand-black/10 bg-brand-black/[0.02] px-3 py-2 text-sm">
        <summary className="cursor-pointer font-medium text-brand-black">
          Email not working? Sign in with admin code
        </summary>
        <form onSubmit={signInWithAdminOtp} className="mt-3 space-y-3">
          <p className="text-xs text-brand-black/70">
            Run Supabase admin <code className="text-xs">generate_link</code> and
            paste the <code className="text-xs">email_otp</code> value here (not
            the long hashed token).
          </p>
          <label className="block text-sm font-medium text-brand-black">
            One-time code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-black/20 bg-brand-white px-3 py-2 text-brand-black outline-none ring-brand-green/40 transition focus:ring-2"
              placeholder="6-digit code"
              disabled={busy !== null}
            />
          </label>
          <button
            type="submit"
            disabled={busy !== null}
            className="w-full rounded-lg border border-brand-green/40 bg-brand-white px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/5 disabled:opacity-60"
          >
            {busy === "otp" ? "Verifying…" : "Verify code"}
          </button>
        </form>
      </details>

      {notice ? (
        <p className="rounded-lg bg-brand-black/5 px-3 py-2 text-center text-sm text-brand-black">
          {notice}
        </p>
      ) : null}

      <p className="text-center text-xs text-brand-black/60">
        Passkeys require{" "}
        <a
          className="text-brand-green underline underline-offset-2"
          href="https://supabase.com/docs/guides/auth/auth-passkeys"
          target="_blank"
          rel="noreferrer"
        >
          Passkeys
        </a>{" "}
        enabled in your Supabase project.
      </p>
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
      setStatus(error.message);
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
