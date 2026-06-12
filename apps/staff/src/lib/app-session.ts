import { createServerClient, isCounselorRole, isEsRole } from "@wayfinder/supabase";
import { getAppSession, type AppSession } from "@wayfinder/supabase/preview-server";
import { notFound, redirect } from "next/navigation";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";

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
