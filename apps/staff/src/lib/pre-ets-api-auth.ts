import {
  canAccessPreEts,
  canAccessPreEtsAccounts,
  canDeliverPreEtsSessions,
  canManagePreEtsSettings,
  canManagePreEtsSetup,
  canSupervisePreEts,
  type PreEtsSettingsRow,
} from "@wayfinder/supabase/pre-ets-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";
import { loadCachedPreEtsSettings } from "./pre-ets-access";

export type PreEtsApiSession = {
  userId: string;
  role: string;
  settings: PreEtsSettingsRow;
};

export async function requirePreEtsApi(
  mode: "access" | "accounts" | "deliver" | "supervise" | "setup" | "settings" = "access"
): Promise<PreEtsApiSession | NextResponse> {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await loadCachedPreEtsSettings();
  const role = session.effectiveRole;

  const allowed =
    mode === "settings"
      ? canManagePreEtsSettings(role)
      : mode === "accounts"
        ? canAccessPreEtsAccounts(role, settings)
        : mode === "deliver"
          ? canDeliverPreEtsSessions(role, settings)
          : mode === "supervise"
            ? canSupervisePreEts(role, settings)
            : mode === "setup"
              ? canManagePreEtsSetup(role, settings)
              : canAccessPreEts(role, settings);

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return {
    userId: session.effectiveUserId,
    role: session.effectiveRole ?? "",
    settings,
  };
}

export function isPreEtsApiError(
  result: PreEtsApiSession | NextResponse
): result is NextResponse {
  return result instanceof NextResponse;
}
