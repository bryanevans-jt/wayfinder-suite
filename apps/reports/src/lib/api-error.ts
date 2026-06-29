import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import {
  errorTechnicalMessage,
  isAccessDenialError,
  respondWithCronLoggedError,
  respondWithLoggedError,
  resolveErrorActor,
  type ApiErrorActor,
} from "@wayfinder/supabase/error-log";

export async function resolveReportErrorActor(): Promise<ApiErrorActor> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};
    return resolveErrorActor(supabase, user.id);
  } catch {
    return {};
  }
}

export async function reportApiLoggedError(
  route: string,
  err: unknown,
  actor?: ApiErrorActor,
  status = 500
) {
  const resolvedActor = actor ?? (await resolveReportErrorActor());
  return respondWithLoggedError("reports", route, err, resolvedActor, status);
}

export async function reportApiCatchError(
  route: string,
  err: unknown,
  actor?: ApiErrorActor
) {
  if (isAccessDenialError(err)) {
    const message = errorTechnicalMessage(err);
    const status = /unauthorized/i.test(message) ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
  return reportApiLoggedError(route, err, actor);
}

export async function reportCronLoggedError(route: string, err: unknown) {
  return respondWithCronLoggedError("reports", route, err);
}
