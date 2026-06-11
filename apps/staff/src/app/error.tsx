"use client";

import { StaffSupportNote } from "@/components/staff-support-note";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";

export default function StaffError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg px-6 py-16 text-brand-black">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-sm text-brand-black/80">{USER_FACING_SYSTEM_ERROR}</p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
      >
        Try again
      </button>
      <StaffSupportNote className="mt-8" />
    </main>
  );
}
