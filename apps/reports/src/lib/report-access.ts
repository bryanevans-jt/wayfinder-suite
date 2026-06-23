import type { SupabaseClient } from "@supabase/supabase-js";
import { canAccessFormalReporting, isAdminTierRole, isSuperAdminRole } from "@wayfinder/supabase/roles";

export async function loadProfileRole(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (data?.role as string | undefined) ?? null;
}

export async function canUseReportingApp(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const role = await loadProfileRole(supabase, userId);
  return canAccessFormalReporting(role);
}

export async function canAccessReportAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const role = await loadProfileRole(supabase, userId);
  if (isAdminTierRole(role)) {
    return true;
  }

  const { data } = await supabase
    .from("report_user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return Boolean(data);
}

export async function isReportSuperadmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const role = await loadProfileRole(supabase, userId);
  if (isSuperAdminRole(role)) {
    return true;
  }

  const { data } = await supabase
    .from("report_user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.role === "superadmin";
}
