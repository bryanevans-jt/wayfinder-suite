import {
  findAuthUserIdByEmail,
  provisionCounselorLoginForMagicLink,
  sendStaffLoginEmail,
} from "@/lib/portal-staff-users";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sends a Wayfinder Pro magic link from the server (no browser PKCE verifier).
 * Works when the user opens the email in a different browser or mail app — pair with
 * the Supabase email template that uses token_hash (see supabase/email-templates/magic-link.html).
 */
export async function POST(request: Request) {
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
    let userId = await findAuthUserIdByEmail(admin, email);
    let notRegisteredMessage: string | undefined;

    if (!userId) {
      const provisioned = await provisionCounselorLoginForMagicLink(admin, email);
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

    await sendStaffLoginEmail(admin, email);
    return Response.json({ sent: true });
  } catch (err) {
    console.error("auth/magic-link failed:", err);
    return Response.json({ error: "Could not send sign-in email" }, { status: 500 });
  }
}
