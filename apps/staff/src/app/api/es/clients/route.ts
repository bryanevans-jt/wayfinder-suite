import { isFieldSpecialistRole } from "@wayfinder/supabase";
import { USER_FACING_AUTH_REQUIRED, USER_FACING_FORBIDDEN } from "@wayfinder/supabase/error-log";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

/** Client creation for field specialists is disabled; admins use the portal API. */
export async function POST() {
  await assertNotPreviewMutation();

  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 });
  }

  if (isFieldSpecialistRole(session.effectiveRole)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
}
