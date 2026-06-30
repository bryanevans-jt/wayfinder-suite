import { ReportSupportNote } from "@/components/ReportSupportNote";
import { ReportsLoginForm } from "@/components/ReportsLoginForm";
import { JOSHUA_TREE_ORG_EMAIL_DOMAIN } from "@wayfinder/branding";
import { accountNotSetUpMessage } from "@wayfinder/supabase/error-log";

type SearchParams = Promise<{ error?: string; next?: string }>;

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function staffTermsUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_STAFF_APP_URL?.replace(/\/$/, "");
  return base ? `${base}/terms` : undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error, next } = await searchParams;
  const redirectAfterSignIn = safeNextPath(next);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-white px-4 py-16">
      {error === "not_set_up" ? (
        <p className="mb-6 max-w-md rounded-lg border border-brand-black/15 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          {accountNotSetUpMessage("Joshua Tree Reports")}
        </p>
      ) : null}
      {error === "org_only" ? (
        <p className="mb-6 max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-900">
          Only @thejoshuatree.org accounts can access formal reporting.
        </p>
      ) : null}
      {error === "forbidden" ? (
        <p className="mb-6 max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950">
          Your Wayfinder Pro role does not include formal reporting. Open Wayfinder Pro for your
          usual workspace.
        </p>
      ) : null}
      {error === "auth" || error === "auth_failed" ? (
        <p className="mb-6 max-w-md rounded-lg border border-brand-gold/40 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          Sign-in could not be completed. Request a new magic link, try Google sign-in, or use your
          passkey again.
        </p>
      ) : null}

      <ReportsLoginForm
        productName="Joshua Tree Reports"
        shouldCreateUser={false}
        googleHostedDomain={JOSHUA_TREE_ORG_EMAIL_DOMAIN}
        termsHref={staffTermsUrl()}
        redirectAfterSignIn={redirectAfterSignIn}
      />

      <ReportSupportNote className="mt-8 max-w-md text-center" />
    </div>
  );
}
