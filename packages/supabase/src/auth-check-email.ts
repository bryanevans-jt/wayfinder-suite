import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "./admin-server";
import { resolveAuthUserIdByEmail } from "./link-client-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthCheckEmailOptions = {
  /**
   * When no auth user exists for this email, attempt to register one (e.g. counselor
   * referral email on file but login never enabled). Return the new/existing user id.
   */
  provisionLogin?: (
    admin: SupabaseClient,
    email: string
  ) => Promise<{ userId: string | null; notRegisteredMessage?: string }>;
};

/** POST { email } → { registered: true } or 404 { registered: false } */
export async function handleAuthCheckEmailRequest(
  request: Request,
  options?: AuthCheckEmailOptions
): Promise<Response> {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  try {
    const admin = createServiceRoleClient();
    let userId = await resolveAuthUserIdByEmail(admin, email);
    let notRegisteredMessage: string | undefined;

    if (!userId && options?.provisionLogin) {
      const provisioned = await options.provisionLogin(admin, email);
      userId = provisioned.userId;
      notRegisteredMessage = provisioned.notRegisteredMessage;
    }

    if (!userId) {
      return Response.json(
        {
          registered: false,
          ...(notRegisteredMessage ? { message: notRegisteredMessage } : {}),
        },
        { status: 404 }
      );
    }
    return Response.json({ registered: true });
  } catch (err) {
    console.error("auth/check-email failed:", err);
    return Response.json({ error: "Could not verify email" }, { status: 500 });
  }
}
