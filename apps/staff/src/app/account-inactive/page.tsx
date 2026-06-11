import { STAFF_APP_PRODUCT_NAME } from "@wayfinder/branding";
import Link from "next/link";

type SearchParams = Promise<{ reason?: string }>;

export default async function AccountInactivePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { reason } = await searchParams;
  const inactive = reason === "inactive";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-white px-6 py-16 text-center">
      <div className="max-w-md space-y-6 rounded-2xl border border-brand-black/15 bg-brand-white p-10 shadow-lg">
        <h1 className="text-2xl font-semibold text-brand-green">Account inactive</h1>
        {inactive ? (
          <p className="text-brand-black/90">
            Your {STAFF_APP_PRODUCT_NAME} account has been deactivated. You have been signed out.
            If you believe this is a mistake, contact your administrator.
          </p>
        ) : (
          <p className="text-brand-black/90">
            This page is shown when an account is not active. You can return to the
            sign-in page to try a different account.
          </p>
        )}
        <Link
          href="/login"
          className="inline-flex rounded-lg bg-brand-green px-5 py-2.5 text-sm font-semibold text-brand-white hover:bg-brand-green/90"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
