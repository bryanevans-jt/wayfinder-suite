"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { LoginForm } from "./login-form";

type Props = {
  productName: string;
  variantLabel?: string;
  shouldCreateUser?: boolean;
  termsHref?: string;
  redirectAfterSignIn?: string;
  createSupabaseClient?: () => SupabaseClient;
};

/** Client-only login shell (reports + staff share this component). */
export function LoginFormShell({
  productName,
  variantLabel,
  shouldCreateUser,
  termsHref,
  redirectAfterSignIn,
  createSupabaseClient,
}: Props) {
  return (
    <LoginForm
      productName={productName}
      variantLabel={variantLabel}
      shouldCreateUser={shouldCreateUser}
      termsHref={termsHref}
      redirectAfterSignIn={redirectAfterSignIn}
      createSupabaseClient={createSupabaseClient}
    />
  );
}
