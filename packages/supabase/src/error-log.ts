import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "./admin-server";
import { roleDisplayName } from "./roles";

export const USER_FACING_SYSTEM_ERROR =
  "Something didn't work quite right on our end, but don't worry — our technical team is already on it. Please try again in a moment. If this keeps happening, your specialist or supervisor can reach out for help.";

export const USER_FACING_AUTH_REQUIRED = "Please sign in again to continue.";

export const USER_FACING_FORBIDDEN = "You don't have access to this feature.";

export const USER_FACING_NOT_FOUND = "We couldn't find what you're looking for.";

export const USER_FACING_ACCOUNT_INACTIVE =
  "Your account is inactive. Please contact your administrator for help.";

const ERROR_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateErrorCode(): string {
  let code = "WF-";
  for (let i = 0; i < 8; i++) {
    code += ERROR_CODE_CHARS[Math.floor(Math.random() * ERROR_CODE_CHARS.length)];
  }
  return code;
}

export type ErrorLogContext = {
  app: "staff" | "client";
  route: string;
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  userRoleLabel?: string | null;
  statusCode?: number;
  metadata?: Record<string, unknown>;
};

export type ApiErrorActor = {
  userId?: string | null;
  userName?: string | null;
  userRole?: string | null;
  userRoleLabel?: string | null;
};

export async function resolveErrorActor(
  supabase: SupabaseClient,
  userId: string
): Promise<ApiErrorActor> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", userId)
    .maybeSingle();

  const role = (profile?.role as string | null | undefined) ?? null;
  return {
    userId,
    userName: (profile?.full_name as string | null | undefined) ?? null,
    userRole: role,
    userRoleLabel: roleDisplayName(role),
  };
}

export async function logSystemError(
  admin: SupabaseClient,
  context: ErrorLogContext,
  err: unknown
): Promise<string> {
  const errorCode = generateErrorCode();
  const technicalMessage = err instanceof Error ? err.message : String(err);
  const stackTrace = err instanceof Error ? err.stack ?? null : null;

  const roleLabel =
    context.userRoleLabel ??
    (context.userRole ? roleDisplayName(context.userRole) : null);

  const { error: insertErr } = await admin.from("system_error_logs").insert({
    error_code: errorCode,
    app: context.app,
    route: context.route,
    user_id: context.userId ?? null,
    user_name: context.userName ?? null,
    user_role: context.userRole ?? null,
    user_role_label: roleLabel,
    status_code: context.statusCode ?? 500,
    technical_message: technicalMessage,
    stack_trace: stackTrace,
    metadata: context.metadata ?? {},
  });

  if (insertErr) {
    console.error("[wayfinder] Failed to persist system error log:", insertErr.message, {
      errorCode,
      route: context.route,
      technicalMessage,
    });
  }

  return errorCode;
}

export async function respondWithLoggedError(
  app: "staff" | "client",
  route: string,
  err: unknown,
  actor: ApiErrorActor = {},
  status = 500
): Promise<Response> {
  try {
    const admin = createServiceRoleClient();
    const errorCode = await logSystemError(
      admin,
      {
        app,
        route,
        userId: actor.userId,
        userName: actor.userName,
        userRole: actor.userRole,
        userRoleLabel: actor.userRoleLabel,
        statusCode: status,
      },
      err
    );
    console.error(`[wayfinder] ${errorCode} ${route}:`, err);
  } catch (logErr) {
    console.error("[wayfinder] Error logging failed:", logErr);
  }

  return Response.json({ error: USER_FACING_SYSTEM_ERROR }, { status });
}

export type AccessErrorLike = {
  message: string;
  status: number;
};

/** Maps known access/auth errors to friendly copy; returns null for system errors. */
export function userFacingAccessMessage(error: AccessErrorLike): string | null {
  if (error.status === 401) return USER_FACING_AUTH_REQUIRED;
  if (error.message === "Account inactive") return USER_FACING_ACCOUNT_INACTIVE;
  if (error.status === 403 && error.message !== "Forbidden" && !looksTechnical(error.message)) {
    return error.message;
  }
  if (error.status === 403) return USER_FACING_FORBIDDEN;
  if (error.status === 404 && error.message !== "Not found" && !looksTechnical(error.message)) {
    return error.message;
  }
  if (error.status === 404) return USER_FACING_NOT_FOUND;
  if (error.status >= 500) return null;
  return null;
}

export async function respondWithAccessOrLoggedError(
  app: "staff" | "client",
  route: string,
  error: unknown,
  actor: ApiErrorActor = {}
): Promise<Response> {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    "message" in error &&
    typeof (error as AccessErrorLike).status === "number" &&
    typeof (error as AccessErrorLike).message === "string"
  ) {
    const access = error as AccessErrorLike;
    const friendly = userFacingAccessMessage(access);
    if (friendly && access.status < 500) {
      return Response.json({ error: friendly }, { status: access.status });
    }
    if (access.status >= 500) {
      return respondWithLoggedError(app, route, error, actor, access.status);
    }
  }
  return respondWithLoggedError(app, route, error, actor);
}

/** Use in client catch blocks when fetch fails outside API error payloads. */
export function friendlyClientError(raw: unknown): string {
  if (raw instanceof Error && raw.message && !looksTechnical(raw.message)) {
    return raw.message;
  }
  if (typeof raw === "string" && raw && !looksTechnical(raw)) {
    return raw;
  }
  return USER_FACING_SYSTEM_ERROR;
}

export const USER_FACING_AUTH_ERROR =
  "We couldn't complete sign-in. Please try again or request a new magic link.";

/** Maps Supabase auth errors to safe copy; keeps actionable hints where helpful. */
export function friendlyAuthError(message: string, redirectHint?: string): string {
  if (/rate limit|too many requests|429/i.test(message)) {
    return "Email rate limit reached. Wait a few minutes and try again. For production traffic, configure custom SMTP in Supabase.";
  }
  if (/redirect/i.test(message) || /url/i.test(message)) {
    return redirectHint
      ? `Sign-in redirect is not configured. Add this URL in Supabase → Authentication → Redirect URLs: ${redirectHint}`
      : "Sign-in redirect is not configured. Check Supabase Authentication URL settings.";
  }
  if (looksTechnical(message)) {
    return USER_FACING_AUTH_ERROR;
  }
  return message;
}

function looksTechnical(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("wf-") ||
    lower.includes("supabase") ||
    lower.includes("postgres") ||
    lower.includes("jwt") ||
    lower.includes("fetch failed") ||
    lower.includes("network") ||
    lower.includes("econnrefused") ||
    lower.includes("digest:") ||
    lower.includes("service_role") ||
    /^[a-z_]+:\s/.test(lower)
  );
}
