import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupClientIdForAuthUser } from "./auth-client-row";
import { createServiceRoleClient } from "./admin-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "./error-log";
import { NextResponse } from "next/server";

export type ClientMessageApiContext = {
  userId: string;
  clientId: string;
  admin: ReturnType<typeof createServiceRoleClient>;
};

const CLIENT_PROFILE_MISSING =
  "Your client profile is not set up yet. Ask your employment specialist to link your account.";

export async function requireClientMessageApiContext(
  supabase: SupabaseClient
): Promise<{ ctx: ClientMessageApiContext } | { error: NextResponse }> {
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

  if (profile?.role !== "client") {
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
    },
  };
}
