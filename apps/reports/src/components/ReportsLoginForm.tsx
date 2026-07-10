"use client";

import { LoginFormShell } from "@wayfinder/auth-ui";
import { createClient } from "@/lib/supabase/client";

type Props = {
  productName: string;
  shouldCreateUser?: boolean;
  googleHostedDomain?: string;
  termsHref?: string;
  privacyHref?: string;
  redirectAfterSignIn?: string;
};

/** Reports Supabase client must be wired inside a Client Component (not passed from RSC). */
export function ReportsLoginForm({
  productName,
  shouldCreateUser,
  googleHostedDomain,
  termsHref,
  privacyHref,
  redirectAfterSignIn,
}: Props) {
  return (
    <LoginFormShell
      productName={productName}
      shouldCreateUser={shouldCreateUser}
      googleHostedDomain={googleHostedDomain}
      termsHref={termsHref}
      privacyHref={privacyHref}
      redirectAfterSignIn={redirectAfterSignIn}
      createSupabaseClient={createClient}
    />
  );
}
