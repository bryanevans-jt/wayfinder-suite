import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupClientIdForAuthUser } from "./auth-client-row";
import { createServiceRoleClient } from "./admin-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "./error-log";
import { getAppSession } from "./preview-server";
import { isClientRole, isSupportRole } from "./roles";
import { NextResponse } from "next/server";

export type ClientMessageApiContext = {
  userId: string;
  clientId: string;
  admin: ReturnType<typeof createServiceRoleClient>;
  /** True when a super admin is previewing as this client (read-only). */
  isReadOnlyPreview: boolean;
};

const CLIENT_PROFILE_MISSING =
  "Your client profile is not set up yet. Ask your Employment Specialist to link your account.";

const PREVIEW_READ_ONLY =
  "Read-only preview — exit preview to send messages as this client.";

export async function requireClientMessageApiContext(
  supabase: SupabaseClient
): Promise<{ ctx: ClientMessageApiContext } | { error: NextResponse }> {
  const session = await getAppSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 }),
    };
  }

  const effectiveRole = session.effectiveRole;
  const isClientFacing = isClientRole(effectiveRole) || isSupportRole(effectiveRole);

  // Preview as client/support: auth user is still super admin, so use effective identity.
  if (session.isPreviewing) {
    if (!isClientFacing || !session.effectiveUserId) {
      return {
        error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }),
      };
    }

    const admin = createServiceRoleClient();
    const clientId = await lookupClientIdForAuthUser(admin, session.effectiveUserId);
    if (!clientId) {
      return {
        error: NextResponse.json({ error: CLIENT_PROFILE_MISSING }, { status: 404 }),
      };
    }

    return {
      ctx: {
        userId: session.effectiveUserId,
        clientId,
        admin,
        isReadOnlyPreview: true,
      },
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "client" && profile?.role !== "support") {
    return {
      error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }),
    };
  }

  const admin = createServiceRoleClient();
  const clientId = await lookupClientIdForAuthUser(admin, user.id);

  if (!clientId) {
    return {
      error: NextResponse.json({ error: CLIENT_PROFILE_MISSING }, { status: 404 }),
    };
  }

  return {
    ctx: {
      userId: user.id,
      clientId,
      admin,
      isReadOnlyPreview: false,
    },
  };
}

export function clientMessagePreviewBlockedResponse(): NextResponse {
  return NextResponse.json({ error: PREVIEW_READ_ONLY }, { status: 403 });
}
