import { createServerClient, isCounselorRole, isEsRole, isSupervisorRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession, type AppSession } from "@wayfinder/supabase/preview-server";
import { notFound, redirect } from "next/navigation";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";
import { clientInSupervisorScope, loadSupervisorScope } from "@/lib/supervisor-client-scope";

export async function requireAppSession(): Promise<AppSession> {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function resolveCounselorForSession(session: AppSession) {
  if (!isCounselorRole(session.effectiveRole)) {
    return null;
  }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("counselors")
    .select("id, full_name")
    .eq("user_id", session.effectiveUserId)
    .maybeSingle();

  return data;
}

export async function requireCounselorSession() {
  const session = await requireAppSession();
  if (!isCounselorRole(session.effectiveRole)) {
    notFound();
  }

  const counselorRow = await resolveCounselorForSession(session);
  if (!counselorRow) {
    return { session, counselorRow: null as null };
  }

  return { session, counselorRow };
}

export async function requireEsClientAccess(session: AppSession, clientId: string) {
  if (!isEsRole(session.effectiveRole)) {
    return false;
  }

  return esIsAssignedToClient(session.effectiveUserId, clientId);
}

export async function requireSupervisorClientAccess(session: AppSession, clientId: string) {
  if (!isSupervisorRole(session.effectiveRole)) {
    return false;
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return false;
  }

  const scope = await loadSupervisorScope(admin, session.effectiveUserId);
  return clientInSupervisorScope(admin, scope, clientId);
}

export async function requireStaffClientAccess(session: AppSession, clientId: string) {
  if (isEsRole(session.effectiveRole)) {
    return requireEsClientAccess(session, clientId);
  }
  if (isSupervisorRole(session.effectiveRole)) {
    const directAssignee = await esIsAssignedToClient(session.effectiveUserId, clientId);
    if (directAssignee) {
      return true;
    }
    return requireSupervisorClientAccess(session, clientId);
  }
  return false;
}
