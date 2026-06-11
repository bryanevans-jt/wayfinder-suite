import { createServerClient } from "@wayfinder/supabase";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { isEsRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

/** @deprecated Use isCommunityPartnersRole from community-partners-auth for employer access */
export function isEsWorkspaceRole(role: string | null | undefined): boolean {
  return isEsRole(role);
}

export async function assertEsWorkspaceSession() {
  const session = await getAppSession();
  if (!session) {
    return { error: NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 }) };
  }

  if (!isEsWorkspaceRole(session.effectiveRole)) {
    return { error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }) };
  }

  const supabase = await createServerClient();
  return {
    session,
    supabase,
    effectiveUserId: session.effectiveUserId,
    readOnly: session.isPreviewing,
  };
}

export async function assertEsWorkspaceMutation() {
  await assertNotPreviewMutation();
  return assertEsWorkspaceSession();
}
