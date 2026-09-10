import { STAFF_APP_PRODUCT_NAME, TermsOfUseContent } from "@wayfinder/branding";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: `Terms of Use — ${STAFF_APP_PRODUCT_NAME}`,
};

export default function StaffTermsPage() {
  return (
    <>
      <a
        href="#terms-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-green focus:shadow"
      >
        Skip to Terms of Use
      </a>
      <main id="terms-main" className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
        <nav aria-label="Related pages">
          <p className="mb-6">
            <Link
              href="/login"
              className="text-sm font-medium text-brand-green underline underline-offset-2"
            >
              ← Back to sign in
            </Link>
          </p>
        </nav>
        <TermsOfUseContent app="staff" />
      </main>
    </>
  );
}
