import { CLIENT_APP_PRODUCT_NAME, PrivacyPolicyContent } from "@wayfinder/branding";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: `Privacy Policy — ${CLIENT_APP_PRODUCT_NAME}`,
};

export default function ClientPrivacyPage() {
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
      <PrivacyPolicyContent app="client" />
    </main>
  );
}
