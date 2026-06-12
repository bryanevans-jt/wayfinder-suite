import { LoginFormShell, SignOutButton } from "@wayfinder/auth-ui";
import {
  CLIENT_APP_PRODUCT_NAME,
  STAFF_APP_PRODUCT_NAME,
} from "@wayfinder/branding";
import { createServerClient, isClientRole } from "@wayfinder/supabase";

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
            {STAFF_APP_PRODUCT_NAME} is for employment specialists, supervisors, and
            administrators.
          </p>
          <p className="text-brand-black/75">
            <a
              href={`${clientAppUrl}/dashboard`}
              className="font-medium text-brand-green underline"
            >
              Open {CLIENT_APP_PRODUCT_NAME}
            </a>{" "}
            or sign out below to use a staff account.
          </p>
          <div className="flex justify-center pt-1">
            <SignOutButton />
          </div>
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
      {error === "auth" ? (
        <p className="mb-6 max-w-md rounded-lg border border-brand-gold/40 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          Sign-in could not be completed. Request a new magic link or use your
          passkey again.
        </p>
      ) : null}
      <LoginFormShell
        productName={STAFF_APP_PRODUCT_NAME}
        shouldCreateUser={false}
        termsHref="/terms"
      />
    </main>
  );
}
