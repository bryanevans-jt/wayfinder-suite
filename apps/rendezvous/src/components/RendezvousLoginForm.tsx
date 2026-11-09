"use client";

import { LoginFormShell } from "@wayfinder/auth-ui";
import { JOSHUA_TREE_ORG_EMAIL_DOMAIN } from "@wayfinder/branding";
import { createClient } from "@/lib/supabase/client";

type Props = {
  redirectAfterSignIn?: string;
  termsHref?: string;
  privacyHref?: string;
};

export function RendezvousLoginForm({
  redirectAfterSignIn,
  termsHref,
  privacyHref,
}: Props) {
  return (
    <LoginFormShell
      productName="Rendezvous"
      shouldCreateUser={false}
      googleHostedDomain={JOSHUA_TREE_ORG_EMAIL_DOMAIN}
      termsHref={termsHref}
      privacyHref={privacyHref}
      redirectAfterSignIn={redirectAfterSignIn}
      createSupabaseClient={createClient}
    />
  );
}
