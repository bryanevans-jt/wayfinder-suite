import { userFacingSystemErrorWithCode } from "@wayfinder/supabase/error-log";

/** Log a failed client-side server-action call and return friendly copy with a WF code. */
export async function reportClientActionError(
  app: "staff" | "client",
  route: string,
  err: unknown
): Promise<{ message: string; errorCode?: string }> {
  const error = err instanceof Error ? err : new Error(String(err));
  try {
    const res = await fetch("/api/system-error/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app,
        route,
        message: error.message,
        digest: (error as Error & { digest?: string }).digest ?? null,
        stack: error.stack ?? null,
      }),
    });
    const data = (await res.json()) as { errorCode?: string; message?: string };
    const errorCode = data.errorCode?.trim().toUpperCase();
    return {
      errorCode,
      message: data.message ?? userFacingSystemErrorWithCode(errorCode),
    };
  } catch {
    return { message: userFacingSystemErrorWithCode() };
  }
}
