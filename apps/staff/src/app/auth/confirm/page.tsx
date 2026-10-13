import { Suspense } from "react";
import { AuthConfirmClient } from "./auth-confirm-client";

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-brand-white px-4">
          <p className="text-sm text-brand-black/70">Loading…</p>
        </main>
      }
    >
      <AuthConfirmClient />
    </Suspense>
  );
}
