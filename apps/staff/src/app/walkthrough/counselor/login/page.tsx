"use client";

import { STAFF_APP_PRODUCT_NAME } from "@wayfinder/branding";
import Link from "next/link";
import { useState } from "react";
import {
  DEMO_LOGIN_BLOCKED_NOTICE,
  DEMO_LOGIN_REAL_ACCESS,
  DEMO_LOGIN_SUBTITLE,
  DEMO_LOGIN_TITLE,
} from "../../lib/demo-copy";

export default function CounselorDemoLoginPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setNotice(DEMO_LOGIN_BLOCKED_NOTICE);
  }

  return (
    <main className="flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-8 rounded-2xl border border-brand-green/25 bg-brand-white p-8 shadow-lg">
        <header className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-green">
            {STAFF_APP_PRODUCT_NAME} · Counselor
          </p>
          <h1 className="text-2xl font-semibold text-brand-green">{DEMO_LOGIN_TITLE}</h1>
          <p className="text-sm text-brand-black/80">{DEMO_LOGIN_SUBTITLE}</p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <label className="block text-sm font-medium text-brand-black">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-black/20 bg-brand-white px-3 py-2 text-brand-black ring-brand-green/40 transition focus-visible:ring-2"
              placeholder="you@gvra.ga.gov"
            />
          </label>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-brand-white shadow hover:bg-brand-green/90"
          >
            Email me a magic link
          </button>
          <button
            type="button"
            onClick={() => setNotice(DEMO_LOGIN_BLOCKED_NOTICE)}
            className="w-full rounded-lg border border-brand-black/25 bg-brand-white px-4 py-2.5 text-sm font-semibold text-brand-black hover:bg-brand-black/[0.03]"
          >
            Sign in with passkey
          </button>
        </form>

        {notice ? (
          <p
            role="alert"
            aria-live="assertive"
            className="rounded-lg bg-brand-black/5 px-3 py-2 text-center text-sm text-brand-black"
          >
            {notice}
          </p>
        ) : null}
      </div>

      <section
        className="mt-10 w-full max-w-md rounded-2xl border-2 border-dashed border-brand-gold/50 bg-brand-gold/10 px-6 py-5 text-center"
        aria-labelledby="demo-access-heading"
      >
        <h2 id="demo-access-heading" className="text-sm font-semibold uppercase tracking-wide text-brand-green">
          Demo purposes only
        </h2>
        <p className="mt-2 text-sm text-brand-black/85">
          This area uses fictional clients and Employment Specialists. It is not connected to live
          company data.
        </p>
        <p className="mt-4">
          <Link
            href="/walkthrough/counselor"
            className="inline-flex rounded-lg bg-brand-green px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-green/90"
          >
            Enter counselor demo
          </Link>
        </p>
        <p className="mt-4 text-xs leading-relaxed text-brand-black/70">{DEMO_LOGIN_REAL_ACCESS}</p>
      </section>
    </main>
  );
}
