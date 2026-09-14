import { LoginFormShell } from "@wayfinder/auth-ui";
import { CLIENT_APP_PRODUCT_NAME } from "@wayfinder/branding";
import { accountNotSetUpMessage } from "@wayfinder/supabase/error-log";

type SearchParams = Promise<{ error?: string; reason?: string }>;

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, reason } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-white px-4 py-16">
      {error === "not_set_up" ? (
        <p className="mb-6 max-w-md rounded-lg border border-brand-black/15 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          {accountNotSetUpMessage(CLIENT_APP_PRODUCT_NAME)}
        </p>
      ) : null}
      {error === "no_profile" ? (
        <p className="mb-6 max-w-md rounded-lg border border-brand-black/15 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          No {CLIENT_APP_PRODUCT_NAME} profile is linked to this account. Ask your employment
          specialist or administrator to finish your setup, then try again.
        </p>
      ) : null}
      {error === "auth" ? (
        <div className="mb-6 max-w-md space-y-2 rounded-lg border border-brand-gold/40 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          <p>
            Sign-in could not be completed. If you are a <strong>counselor or Joshua Tree staff
            member</strong>, use{" "}
            <a
              href={
                process.env.NEXT_PUBLIC_STAFF_APP_URL
                  ? `${process.env.NEXT_PUBLIC_STAFF_APP_URL.replace(/\/$/, "")}/login`
                  : "/login"
              }
              className="font-semibold text-brand-green underline"
            >
              Wayfinder Pro
            </a>{" "}
            to request a magic link — not this participant app.
          </p>
          {reason === "pkce_verifier" ? (
            <p className="text-xs text-brand-black/70">
              Open the link in the same browser where you tapped &quot;Email me a magic link.&quot;
            </p>
          ) : null}
        </div>
      ) : null}
      <LoginFormShell productName={CLIENT_APP_PRODUCT_NAME} termsHref="/terms" privacyHref="/privacy" />
    </main>
  );
}
