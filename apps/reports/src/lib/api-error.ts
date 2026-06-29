import { createClient } from "@/lib/supabase/server";
import {
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
