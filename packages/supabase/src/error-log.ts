import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SUPPORT_CONTACT_EMAIL,
  SUPPORT_CONTACT_NAME,
} from "@wayfinder/branding";
import { createServiceRoleClient } from "./admin-server";
import { roleDisplayName } from "./roles";

export const USER_FACING_SUPPORT_LINE = `Email ${SUPPORT_CONTACT_NAME} at ${SUPPORT_CONTACT_EMAIL}.`;

export const USER_FACING_SYSTEM_ERROR =
  "Something didn't work quite right on our end, but don't worry — our team is already looking into it. Please try again in a moment.";

/** User-facing message with an optional WF reference code. */
export function userFacingSystemErrorWithCode(errorCode?: string | null): string {
  if (!errorCode?.trim()) {
    return `${USER_FACING_SYSTEM_ERROR} If this keeps happening, ${USER_FACING_SUPPORT_LINE.charAt(0).toLowerCase()}${USER_FACING_SUPPORT_LINE.slice(1)}`;
  }
  return `${USER_FACING_SYSTEM_ERROR} Reference code: ${errorCode.trim().toUpperCase()}. ${USER_FACING_SUPPORT_LINE}`;
}

export type ActionSuccess = { ok: true; warning?: string };
export type ActionFailure = { ok: false; error: string; errorCode?: string };
export type ActionResult = ActionSuccess | ActionFailure;

/** Log a failed server action and return a safe message (avoids Next.js production throw redaction). */
export type WayfinderErrorApp = "staff" | "client" | "reports";

export async function finishActionFailure(
  app: WayfinderErrorApp,
  route: string,
  err: unknown,
  actor: ApiErrorActor = {},
  userHint?: string
): Promise<ActionFailure> {
  let errorCode: string | undefined;
  try {
    const admin = createServiceRoleClient();
    errorCode = await logSystemError(
      admin,
      {
        app,
        route,
        userId: actor.userId,
        userName: actor.userName,
        userRole: actor.userRole,
        userRoleLabel: actor.userRoleLabel,
        metadata: { server_action: true },
      },
      err
    );
    console.error(`[wayfinder] ${errorCode} ${route}:`, err);
  } catch (logErr) {
    console.error("[wayfinder] Server action error logging failed:", logErr);
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  let hint = userHint?.trim();
  if (!hint && rawMessage) {
    hint = friendlyApplicationSaveError(rawMessage);
  }
  if (!hint || looksTechnical(hint)) {
    hint = "We could not complete that action. Please try again.";
  }

  const error = errorCode
    ? `${hint} Reference code: ${errorCode}. ${USER_FACING_SUPPORT_LINE}`
    : `${hint} ${USER_FACING_SUPPORT_LINE}`;

  return { ok: false, error, errorCode };
}

export type ApiErrorPayload = {
  error?: string;
  errorCode?: string;
};

/** Parse a failed fetch response into a friendly message and optional reference code. */
export async function parseApiErrorResponse(res: Response): Promise<{
  message: string;
  errorCode?: string;
}> {
  let payload: ApiErrorPayload | null = null;
  try {
    payload = (await res.json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }
  const errorCode = payload?.errorCode?.trim().toUpperCase();
  const message =
    payload?.error && !looksTechnical(payload.error)
      ? payload.error
      : userFacingSystemErrorWithCode(errorCode);
  return { message, errorCode };
}

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
  app: WayfinderErrorApp;
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
  app: WayfinderErrorApp,
  route: string,
  err: unknown,
  actor: ApiErrorActor = {},
  status = 500
): Promise<Response> {
  let errorCode: string | undefined;
  try {
    const admin = createServiceRoleClient();
    errorCode = await logSystemError(
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

  return Response.json(
    { error: userFacingSystemErrorWithCode(errorCode), errorCode: errorCode ?? null },
    { status }
  );
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
  app: WayfinderErrorApp,
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
export function friendlyClientError(raw: unknown, errorCode?: string | null): string {
  if (raw instanceof Error && raw.message && !looksTechnical(raw.message)) {
    const code = errorCode ?? (raw as Error & { errorCode?: string }).errorCode;
    if (code && !raw.message.includes(code)) {
      return `${raw.message} Reference code: ${code.toUpperCase()}.`;
    }
    return raw.message;
  }
  if (typeof raw === "string" && raw && !looksTechnical(raw)) {
    return raw;
  }
  return userFacingSystemErrorWithCode(errorCode);
}

/** Log a server-action failure and throw a safe message the client can display (with WF code when logged). */
export async function throwLoggedUserError(
  app: WayfinderErrorApp,
  route: string,
  err: unknown,
  actor: ApiErrorActor = {},
  userHint?: string
): Promise<never> {
  let errorCode: string | undefined;
  try {
    const admin = createServiceRoleClient();
    errorCode = await logSystemError(
      admin,
      {
        app,
        route,
        userId: actor.userId,
        userName: actor.userName,
        userRole: actor.userRole,
        userRoleLabel: actor.userRoleLabel,
        metadata: { server_action: true },
      },
      err
    );
    console.error(`[wayfinder] ${errorCode} ${route}:`, err);
  } catch (logErr) {
    console.error("[wayfinder] Server action error logging failed:", logErr);
  }

  const hint = userHint?.trim() || "We could not complete that action. Please try again.";
  const msg = errorCode
    ? `${hint} Reference code: ${errorCode}. ${USER_FACING_SUPPORT_LINE}`
    : `${hint} ${USER_FACING_SUPPORT_LINE}`;
  const error = new Error(msg);
  (error as Error & { errorCode?: string }).errorCode = errorCode;
  throw error;
}

export function friendlyApplicationSaveError(message: string): string {
  if (/invalid input syntax for type uuid/i.test(message)) {
    return "We could not link that employer. Enter the company name only, or pick a different employer from the network.";
  }
  if (/foreign key constraint/i.test(message)) {
    return "We could not save this record for this client. Refresh the page and try again.";
  }
  if (/null value in column "company_name"/i.test(message)) {
    return "Company name is required.";
  }
  if (/null value in column/i.test(message) && /outcome/i.test(message)) {
    return "Please enter contact notes.";
  }
  if (/Could not save contact log/i.test(message)) {
    return "We could not save this contact log for this client. Refresh the page and try again.";
  }
  if (looksTechnical(message)) {
    return "We could not save this record. Please try again.";
  }
  return message;
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
  if (/rp id|relying party|webauthn/i.test(message)) {
    return (
      "Passkeys are not configured for this site domain. In Supabase → Authentication → Passkeys, " +
      "set Relying Party ID to your shared domain (e.g. thejoshuatree.org) and add every app URL " +
      "(Wayfinder and Wayfinder Pro) under Relying Party Origins. Until then, use a magic link to sign in."
    );
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
    lower.includes("server components render") ||
    lower.includes("an error occurred in the server") ||
    lower.includes("server action") ||
    lower.includes("service_role") ||
    /^[a-z_]+:\s/.test(lower)
  );
}
