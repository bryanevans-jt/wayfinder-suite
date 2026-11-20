import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  PREVIEW_ACTOR_COOKIE,
  PREVIEW_DEMO_ONLY_COOKIE,
  PREVIEW_NAME_COOKIE,
  PREVIEW_ROLE_COOKIE,
  PREVIEW_TARGET_COOKIE,
  previewCookieOptions,
} from "@wayfinder/supabase/preview-cookies";
import { previewRedirectUrl } from "@wayfinder/supabase/preview-server";
import { buildClientPreviewHandoffUrl } from "@wayfinder/supabase/preview-handoff";
import {
  canUseViewAsPreview,
  canViewAsTargetRole,
} from "@wayfinder/supabase/preview-policy";
import { createClient } from "@wayfinder/supabase/server";
import { isClientRole, isKnownRole } from "@wayfinder/supabase/roles";
import {
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/preview/start";
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
    }

    const actor = await resolveErrorActor(supabase, user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_active || !canUseViewAsPreview(profile.role)) {
      return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
    }

    const body = (await request.json()) as {
      targetUserId?: string;
      demoClientsOnly?: boolean;
    };
    const targetUserId = body.targetUserId?.trim();
    const demoClientsOnly = body.demoClientsOnly === true;
    if (!targetUserId) {
      return NextResponse.json({ error: "Please select a user to preview." }, { status: 400 });
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Choose another user to preview." }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data: targetProfile, error } = await admin
      .from("profiles")
      .select("role, is_active, full_name")
      .eq("id", targetUserId)
      .maybeSingle();

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    if (!targetProfile?.is_active || !isKnownRole(targetProfile.role)) {
      return NextResponse.json(
        { error: "Target user not available for preview." },
        { status: 404 }
      );
    }

    const targetRole = targetProfile.role as string;
    // Staff View as is limited to the approved role list; client/support handoff remains.
    if (!isClientRole(targetRole) && !canViewAsTargetRole(targetRole)) {
      return NextResponse.json(
        { error: "That role is not available for View as." },
        { status: 400 }
      );
    }

    await admin.from("preview_audit_logs").insert({
      actor_user_id: user.id,
      target_user_id: targetUserId,
      target_role: targetRole,
      action: "enter",
      demo_clients_only: demoClientsOnly,
    });

    const redirectUrl = isClientRole(targetRole)
      ? buildClientPreviewHandoffUrl({
          targetUserId,
          actorUserId: user.id,
          targetRole,
          targetName: (targetProfile.full_name as string | null) ?? null,
        })
      : previewRedirectUrl(targetRole);
    const response = NextResponse.json({
      ok: true,
      redirectUrl,
      target: {
        id: targetUserId,
        role: targetRole,
        name: targetProfile.full_name,
        demoClientsOnly,
      },
    });

    const opts = previewCookieOptions();
    response.cookies.set(PREVIEW_TARGET_COOKIE, targetUserId, opts);
    response.cookies.set(PREVIEW_ACTOR_COOKIE, user.id, opts);
    response.cookies.set(PREVIEW_ROLE_COOKIE, targetRole, opts);
    if (targetProfile.full_name) {
      response.cookies.set(PREVIEW_NAME_COOKIE, targetProfile.full_name, opts);
    }
    if (demoClientsOnly) {
      response.cookies.set(PREVIEW_DEMO_ONLY_COOKIE, "1", opts);
    } else {
      response.cookies.set(PREVIEW_DEMO_ONLY_COOKIE, "", { ...opts, maxAge: 0 });
    }

    return response;
  } catch (err) {
    return respondWithLoggedError("staff", route, err);
  }
}
