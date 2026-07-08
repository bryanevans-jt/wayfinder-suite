import type { SupabaseClient } from "@supabase/supabase-js";

export type InsertRosterClientParams = {
  fullName: string;
  counselorId?: string | null;
  employmentGoalPrimary?: string | null;
  officeId?: string | null;
  serviceId?: string | null;
  stageId?: string | null;
  contactEmail?: string | null;
};

/** Inserts a login-less client row (requires migration 20260707181500). */
export async function insertRosterClientRecord(
  admin: SupabaseClient,
  params: InsertRosterClientParams
): Promise<{ id: string } | { error: string }> {
  const fullName = params.fullName.trim();
  if (!fullName) {
    return { error: "Client name is required" };
  }

  const row: Record<string, string | null> = {
    full_name: fullName,
    counselor_id: params.counselorId?.trim() || null,
    office_id: params.officeId?.trim() || null,
    employment_goal_primary: params.employmentGoalPrimary?.trim() || null,
    user_id: null,
    profile_id: null,
    current_service_id: params.serviceId?.trim() || null,
    current_stage_id: params.stageId?.trim() || null,
    contact_email: params.contactEmail?.trim().toLowerCase() || null,
  };

  const { data, error } = await admin.from("clients").insert(row).select("id").single();

  if (error || !data?.id) {
    return { error: error?.message ?? "Could not create roster client" };
  }

  return { id: data.id as string };
}
