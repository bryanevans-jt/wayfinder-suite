"use client";

import dynamic from "next/dynamic";

const LoginFormClient = dynamic(
  () => import("./login-form").then((m) => ({ default: m.LoginForm })),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full max-w-md space-y-8 rounded-2xl border border-brand-green/25 bg-brand-white p-8 shadow-lg"
        aria-busy="true"
        aria-label="Loading sign-in"
      >
        <div className="h-52 animate-pulse rounded-lg bg-brand-black/10" />
      </div>
    ),
  }
);

type Props = {
  productName: string;
  variantLabel?: string;
  shouldCreateUser?: boolean;
  termsHref?: string;
};

/**
 * Client-only mount for the login form so devtools / embedded browsers that inject
 * attributes (e.g. data-cursor-ref) cannot cause React hydration mismatches.
 */
export function LoginFormShell({
  productName,
  variantLabel,
  shouldCreateUser,
  termsHref,
}: Props) {
  return (
    <LoginFormClient
      productName={productName}
      variantLabel={variantLabel}
      shouldCreateUser={shouldCreateUser}
      termsHref={termsHref}
    />
  );
}
