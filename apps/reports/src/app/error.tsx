"use client";

import { AppErrorScreen } from "@wayfinder/auth-ui";

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <AppErrorScreen error={error} reset={reset} app="reports" />;
}
