import { RendezvousLoginForm } from "@/components/RendezvousLoginForm";
import { JOSHUA_TREE_ORG_EMAIL_DOMAIN } from "@wayfinder/branding";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";

type SearchParams = Promise<{ error?: string; next?: string }>;

function safeNextPath(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, next } = await searchParams;
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
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-16">
      <p className="font-[family-name:var(--font-rv-display)] text-4xl font-semibold text-brand-green">
        Rendezvous
      </p>
      <p className="mt-2 text-brand-black/70">Sign in with your Joshua Tree account.</p>
      {error === "org_only" ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Only @thejoshuatree.org accounts can sign in here.
        </p>
      ) : null}
      <div className="mt-8 rounded-2xl border border-brand-green/15 bg-white/90 p-6 shadow-sm">
        <RendezvousLoginForm
          redirectAfterSignIn={redirectAfterSignIn}
          termsHref={staffBase ? `${staffBase}/terms` : undefined}
          privacyHref={staffBase ? `${staffBase}/privacy` : undefined}
        />
      </div>
    </div>
  );
}
