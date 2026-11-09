import { RendezvousLoginForm } from "@/components/RendezvousLoginForm";
import { AppShell } from "@/components/AppShell";
import { JOSHUA_TREE_ORG_EMAIL_DOMAIN } from "@wayfinder/branding";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";

type SearchParams = Promise<{ error?: string; next?: string; reason?: string }>;

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, next, reason } = await searchParams;
  const redirectAfterSignIn = safeNextPath(next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user?.email?.endsWith(`@${JOSHUA_TREE_ORG_EMAIL_DOMAIN}`)) {
    const { data: rpcRows } = await supabase.rpc("get_auth_user_profile");
    const row = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as { role?: string } | undefined;
    const role = row?.role ? String(row.role).toLowerCase() : "";
    if (isSuperAdminRole(role)) {
      redirect(redirectAfterSignIn);
    }
  }

  const staffBase = process.env.NEXT_PUBLIC_STAFF_APP_URL?.replace(/\/$/, "");

  return (
    <AppShell>
      <section className="rv-hero-plane min-h-[min(78vh,720px)]">
        <div className="rv-hero-content mx-auto max-w-5xl">
          <h1 className="rv-rise rv-brand text-6xl sm:text-7xl md:text-8xl">Rendezvous</h1>
          <p className="rv-rise rv-rise-delay-1 mt-5 max-w-lg text-lg text-brand-black/75 sm:text-xl">
            Sign In With Your Joshua Tree Account.
          </p>
        </div>
      </section>

      <div className="rv-shell relative z-10 -mt-16 pb-16 pt-0 sm:-mt-20">
        {error === "org_only" ? (
          <p className="rv-rise mb-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
            Only @thejoshuatree.org accounts can sign in here.
          </p>
        ) : null}
        {error === "not_set_up" ? (
          <p className="rv-rise mb-4 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            This Google account is not provisioned in Wayfinder yet.
          </p>
        ) : null}
        {error === "auth" || error === "forbidden" ? (
          <p className="rv-rise mb-4 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
            Sign-In Didn&apos;t Complete
            {reason
              ? `: ${reason}`
              : ". Check Supabase redirect URLs include this app’s /auth/callback, then clear cookies for rendezvous.thejoshuatree.org and try again."}
          </p>
        ) : null}
        <div className="rv-rise rv-rise-delay-2 rv-panel mx-auto max-w-md rounded-3xl p-2 sm:p-3">
          <RendezvousLoginForm
            redirectAfterSignIn={redirectAfterSignIn}
            termsHref={staffBase ? `${staffBase}/terms` : undefined}
            privacyHref={staffBase ? `${staffBase}/privacy` : undefined}
          />
        </div>
      </div>
    </AppShell>
  );
}
