"use client";

import { LoginFormShell } from "@wayfinder/auth-ui";
import { JOSHUA_TREE_ORG_EMAIL_DOMAIN, STAFF_APP_PRODUCT_NAME } from "@wayfinder/branding";
import Link from "next/link";
import { DEMO_LOGIN_BLOCKED_NOTICE, DEMO_LOGIN_REAL_ACCESS } from "../../lib/demo-copy";

export default function CounselorDemoLoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-white px-4 py-16">
      <LoginFormShell
        productName={STAFF_APP_PRODUCT_NAME}
        shouldCreateUser={false}
        googleHostedDomain={JOSHUA_TREE_ORG_EMAIL_DOMAIN}
        termsHref="/terms"
        privacyHref="/privacy"
        demoMode
        demoBlockedNotice={DEMO_LOGIN_BLOCKED_NOTICE}
      />

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
