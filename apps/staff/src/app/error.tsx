"use client";

import { StaffSupportNote } from "@/components/staff-support-note";
import { AppErrorScreen } from "@wayfinder/auth-ui";

export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <>
      <AppErrorScreen error={error} reset={reset} app="staff" />
      <div className="mx-auto max-w-lg px-6 pb-16">
        <StaffSupportNote className="mt-0" />
      </div>
    </>
  );
}
