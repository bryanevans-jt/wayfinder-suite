import { Suspense } from "react";
import { AuthAccessClient } from "./auth-access-client";

export default function AuthAccessPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-brand-white px-4">
          <p className="text-sm text-brand-black/70">Loading…</p>
        </main>
      }
    >
      <AuthAccessClient />
    </Suspense>
  );
}
