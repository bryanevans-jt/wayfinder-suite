import { createServiceRoleClient } from "./admin-server";
import {
  clearPreviewCookiesOnResponse,
  readPreviewCookies,
} from "./preview-cookies";
import { createClient } from "./server";
import { isSuperAdminRole } from "./roles";

type CookieGetter = (name: string) => string | undefined;

type StopResult = {
  ok: boolean;
  actorUserId: string | null;
  hadPreview: boolean;
};

/** End preview session: audit log (if active) and clear preview cookies on the response. */
export async function stopPreviewSession(
  cookieGet: CookieGetter,
  response: Parameters<typeof clearPreviewCookiesOnResponse>[0]
): Promise<StopResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const preview = readPreviewCookies(cookieGet);
  clearPreviewCookiesOnResponse(response);

  if (!user) {
    return { ok: false, actorUserId: null, hadPreview: Boolean(preview) };
  }

  if (
    preview &&
    preview.actorUserId === user.id &&
    preview.targetUserId
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.is_active && isSuperAdminRole(profile.role)) {
      try {
        const admin = createServiceRoleClient();
        await admin.from("preview_audit_logs").insert({
          actor_user_id: user.id,
          target_user_id: preview.targetUserId,
          target_role: preview.targetRole,
          action: "exit",
        });
      } catch {
        // Audit failure should not block exit.
      }
    }
  }

  return { ok: true, actorUserId: user.id, hadPreview: Boolean(preview) };
}
