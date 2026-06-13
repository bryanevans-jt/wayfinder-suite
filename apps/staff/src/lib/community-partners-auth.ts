import { createServerClient } from "@wayfinder/supabase";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { isAdminTierRole, isEsRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

/** JTSG staff who can view the Community Partners directory and map. */
export function isCommunityPartnersRole(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return (
    isEsRole(r) ||
    isAdminTierRole(r) ||
    isSupervisorRole(r) ||
    r === "accountant"
  );
}

export function canEditCommunityPartners(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return isEsRole(r) || isAdminTierRole(r) || isSupervisorRole(r);
}

export async function assertCommunityPartnersSession() {
  const session = await getAppSession();
  if (!session) {
    return { error: NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 }) };
  }

  if (!isCommunityPartnersRole(session.effectiveRole)) {
    return { error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }) };
  }

  const supabase = await createServerClient();
  const isAdminTier = isAdminTierRole(session.effectiveRole);

  return {
    session,
    supabase,
    effectiveUserId: session.effectiveUserId,
    readOnly: session.isPreviewing,
    isAdminTier,
    canDelete: isAdminTier && !session.isPreviewing,
  };
}

export async function assertCommunityPartnersMutation() {
  await assertNotPreviewMutation();
  const result = await assertCommunityPartnersSession();
  if ("error" in result && result.error) {
    return result;
  }
  if (!canEditCommunityPartners(result.session.effectiveRole)) {
    return { error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }) };
  }
  return result;
}
