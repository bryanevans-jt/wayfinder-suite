import { createServerClient, isEsRole, isSupervisorRole } from "@wayfinder/supabase";
import {
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export type StaffExportRole = "es" | "supervisor";

export async function assertStaffExportSession(allowed: StaffExportRole[]) {
  const session = await getAppSession();
  if (!session) {
    return { error: NextResponse.json({ error: USER_FACING_AUTH_REQUIRED }, { status: 401 }) };
  }

  const role = session.effectiveRole;
  const es = isEsRole(role);
  const supervisor = isSupervisorRole(role);

  const ok =
    (allowed.includes("es") && es) || (allowed.includes("supervisor") && supervisor);

  if (!ok) {
    return { error: NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 }) };
  }

  const supabase = await createServerClient();
  return {
    supabase,
    user: { id: session.effectiveUserId },
    role: es ? ("es" as const) : ("supervisor" as const),
    readOnly: session.isPreviewing,
  };
}
