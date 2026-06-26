"use client";

import { LoginForm } from "./login-form";

type Props = {
  productName: string;
  variantLabel?: string;
  shouldCreateUser?: boolean;
  termsHref?: string;
  redirectAfterSignIn?: string;
};

/** Client-only login shell (reports + staff share this component). */
export function LoginFormShell({
  productName,
  variantLabel,
  shouldCreateUser,
  termsHref,
  redirectAfterSignIn,
}: Props) {
  return (
    <LoginForm
      productName={productName}
      variantLabel={variantLabel}
      shouldCreateUser={shouldCreateUser}
      termsHref={termsHref}
      redirectAfterSignIn={redirectAfterSignIn}
    />
  );
}
