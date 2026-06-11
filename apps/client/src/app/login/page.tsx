import { LoginFormShell } from "@wayfinder/auth-ui";
import { CLIENT_APP_PRODUCT_NAME } from "@wayfinder/branding";

type SearchParams = Promise<{ error?: string }>;

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-brand-white px-4 py-16">
      {error === "no_profile" ? (
        <p className="mb-6 max-w-md rounded-lg border border-brand-black/15 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          No {CLIENT_APP_PRODUCT_NAME} profile is linked to this account. Ask your employment
          specialist or administrator to finish your setup, then try again.
        </p>
      ) : null}
      {error === "auth" ? (
        <p className="mb-6 max-w-md rounded-lg border border-brand-gold/40 bg-brand-white px-4 py-3 text-center text-sm text-brand-black">
          Sign-in could not be completed. Request a new magic link or use your passkey
          again.
        </p>
      ) : null}
      <LoginFormShell productName={CLIENT_APP_PRODUCT_NAME} />
    </main>
  );
}
