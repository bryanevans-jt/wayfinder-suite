"use client";

import { LoginFormShell } from "@wayfinder/auth-ui";
import { createClient } from "@/lib/supabase/client";

type Props = {
  productName: string;
  shouldCreateUser?: boolean;
  googleHostedDomain?: string;
  termsHref?: string;
  redirectAfterSignIn?: string;
};

/** Reports Supabase client must be wired inside a Client Component (not passed from RSC). */
export function ReportsLoginForm({
  productName,
  shouldCreateUser,
  googleHostedDomain,
  termsHref,
  redirectAfterSignIn,
}: Props) {
  return (
    <LoginFormShell
      productName={productName}
      shouldCreateUser={shouldCreateUser}
      googleHostedDomain={googleHostedDomain}
      termsHref={termsHref}
      redirectAfterSignIn={redirectAfterSignIn}
      createSupabaseClient={createClient}
    />
  );
}
