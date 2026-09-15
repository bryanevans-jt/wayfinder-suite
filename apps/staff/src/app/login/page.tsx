import { LoginFormShell, SignOutButton } from "@wayfinder/auth-ui";
import {
  CLIENT_APP_PRODUCT_NAME,
  JOSHUA_TREE_ORG_EMAIL_DOMAIN,
  STAFF_APP_PRODUCT_NAME,
} from "@wayfinder/branding";
import { createServerClient, isClientRole } from "@wayfinder/supabase";
import { accountNotSetUpMessage } from "@wayfinder/supabase/error-log";

type SearchParams = Promise<{ error?: string; reason?: string }>;

const clientAppUrl =
  process.env.NEXT_PUBLIC_CLIENT_APP_URL ?? "http://localhost:3001";

export default async function StaffLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, reason } = await searchParams;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let signedInAsClient = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    signedInAsClient = isClientRole(profile?.role);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-white px-4 py-16">
      {signedInAsClient ? (
        <div className="mb-6 max-w-md space-y-3 rounded-lg border border-brand-gold/40 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          <p>
            You&apos;re signed in with a <strong>client</strong> account.{" "}
            {STAFF_APP_PRODUCT_NAME} is for Employment Specialists, supervisors, and
            administrators.
          </p>
          <p className="text-brand-black/75">
            <a
              href={`${clientAppUrl}/dashboard`}
              className="font-medium text-brand-green underline"
            >
              Open {CLIENT_APP_PRODUCT_NAME}
            </a>{" "}
            or sign out below to use a team member account.
          </p>
          <div className="flex justify-center pt-1">
            <SignOutButton />
          </div>
        </div>
      ) : null}
      {error === "not_set_up" ? (
        <div className="mb-6 max-w-md space-y-2 rounded-lg border border-brand-black/15 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          <p>{reason?.trim() || accountNotSetUpMessage(STAFF_APP_PRODUCT_NAME)}</p>
        </div>
      ) : null}
      {error === "no_profile" ? (
        <div className="mb-6 max-w-md space-y-2 rounded-lg border border-brand-black/15 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          <p>
            No {STAFF_APP_PRODUCT_NAME} profile is linked to this account. Ask an administrator to
            assign a role, then try again.
          </p>
          {reason ? (
            <p className="text-left text-xs text-brand-black/60">Detail: {reason}</p>
          ) : null}
        </div>
      ) : null}
      {error === "org_only" ? (
        <p className="mb-6 max-w-md rounded-lg border border-brand-black/15 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          Use your <strong>@{JOSHUA_TREE_ORG_EMAIL_DOMAIN}</strong> Google account for{" "}
          {STAFF_APP_PRODUCT_NAME}.
        </p>
      ) : null}
      {error === "auth" ? (
        <div className="mb-6 max-w-md space-y-2 rounded-lg border border-brand-gold/40 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          <p>
            Sign-in could not be completed. Request a new magic link from{" "}
            <strong>Wayfinder Pro</strong> (not the participant Wayfinder app), open the link in the
            same browser where you requested it, or try Google sign-in / passkey.
          </p>
          {reason === "pkce_verifier" ? (
            <p className="text-xs text-brand-black/70">
              This usually means the link was opened in a different browser or app than the one that
              requested the email.
            </p>
          ) : null}
          {reason === "redirect_mismatch" ? (
            <p className="text-xs text-brand-black/70">
              Ask your administrator to confirm Supabase redirect URLs include{" "}
              <span className="font-mono text-[11px]">…/auth/callback</span> for Wayfinder Pro.
            </p>
          ) : null}
          {reason === "link_expired" ? (
            <p className="text-xs text-brand-black/70">
              Magic links expire quickly — request a fresh one and use it within a few minutes.
            </p>
          ) : null}
        </div>
      ) : null}
      <LoginFormShell
        productName={STAFF_APP_PRODUCT_NAME}
        shouldCreateUser={false}
        requireExistingAccount
        magicLinkEndpoint="/api/auth/magic-link"
        googleHostedDomain={JOSHUA_TREE_ORG_EMAIL_DOMAIN}
        termsHref="/terms"
        privacyHref="/privacy"
      />
    </main>
  );
}
