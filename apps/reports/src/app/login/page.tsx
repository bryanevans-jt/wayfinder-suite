import { LoginFormShell } from "@wayfinder/auth-ui";
import { ReportSupportNote } from "@/components/ReportSupportNote";
import { createClient } from "@/lib/supabase/client";

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
          Sign-in could not be completed. Request a new magic link or use your passkey again.
        </p>
      ) : null}

      <LoginFormShell
        productName="Joshua Tree Reports"
        shouldCreateUser={false}
        termsHref={staffTermsUrl()}
        redirectAfterSignIn={redirectAfterSignIn}
        createSupabaseClient={createClient}
      />

      <ReportSupportNote className="mt-8 max-w-md text-center" />
    </div>
  );
}
