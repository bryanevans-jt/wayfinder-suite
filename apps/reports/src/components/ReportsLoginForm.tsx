"use client";

import { LoginFormShell } from "@wayfinder/auth-ui";
import { createClient } from "@/lib/supabase/client";

type Props = {
  productName: string;
  shouldCreateUser?: boolean;
  termsHref?: string;
  redirectAfterSignIn?: string;
};

/** Host-only Supabase client must be wired inside a Client Component (not passed from RSC). */
export function ReportsLoginForm({
  productName,
  shouldCreateUser,
  termsHref,
  redirectAfterSignIn,
}: Props) {
  return (
    <LoginFormShell
      productName={productName}
      shouldCreateUser={shouldCreateUser}
      termsHref={termsHref}
      redirectAfterSignIn={redirectAfterSignIn}
      createSupabaseClient={createClient}
    />
  );
}
