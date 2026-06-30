import { createServiceRoleClient } from "./admin-server";
import { resolveAuthUserIdByEmail } from "./link-client-auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST { email } → { registered: true } or 404 { registered: false } */
export async function handleAuthCheckEmailRequest(request: Request): Promise<Response> {
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
    const userId = await resolveAuthUserIdByEmail(admin, email);
    if (!userId) {
      return Response.json({ registered: false }, { status: 404 });
    }
    return Response.json({ registered: true });
  } catch (err) {
    console.error("auth/check-email failed:", err);
    return Response.json({ error: "Could not verify email" }, { status: 500 });
  }
}
