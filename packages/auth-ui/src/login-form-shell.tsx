"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { LoginForm } from "./login-form";

type Props = {
  productName: string;
  variantLabel?: string;
  shouldCreateUser?: boolean;
  requireExistingAccount?: boolean;
  googleHostedDomain?: string;
  termsHref?: string;
  privacyHref?: string;
  redirectAfterSignIn?: string;
  createSupabaseClient?: () => SupabaseClient;
  demoMode?: boolean;
  demoBlockedNotice?: string;
};

/** Client-only login shell (reports + staff share this component). */
export function LoginFormShell({
  productName,
  variantLabel,
  shouldCreateUser,
  requireExistingAccount,
  googleHostedDomain,
  termsHref,
  privacyHref,
  redirectAfterSignIn,
  createSupabaseClient,
  demoMode,
  demoBlockedNotice,
}: Props) {
  return (
    <LoginForm
      productName={productName}
      variantLabel={variantLabel}
      shouldCreateUser={shouldCreateUser}
      requireExistingAccount={requireExistingAccount}
      googleHostedDomain={googleHostedDomain}
      termsHref={termsHref}
      privacyHref={privacyHref}
      redirectAfterSignIn={redirectAfterSignIn}
      createSupabaseClient={createSupabaseClient}
      demoMode={demoMode}
      demoBlockedNotice={demoBlockedNotice}
    />
  );
}
