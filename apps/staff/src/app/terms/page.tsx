import { STAFF_APP_PRODUCT_NAME, TermsOfUseContent } from "@wayfinder/branding";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: `Terms of Use — ${STAFF_APP_PRODUCT_NAME}`,
};

export default function StaffTermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <p className="mb-6">
        <Link
          href="/login"
          className="text-sm font-medium text-brand-green underline underline-offset-2"
        >
          ← Back to sign in
        </Link>
      </p>
      <TermsOfUseContent app="staff" />
    </main>
  );
}
