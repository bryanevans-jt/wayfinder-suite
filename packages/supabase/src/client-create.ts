import type { SupabaseClient } from "@supabase/supabase-js";
import { insertClientRecord } from "./client-insert";

export type CreateClientParams = {
  name: string;
  email: string;
  serviceId: string;
  officeId: string;
  counselorId: string;
  esUserId?: string;
};

export async function createClientWithInvite(
  admin: SupabaseClient,
  params: CreateClientParams
): Promise<{ clientId: string } | { error: string }> {
  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const serviceId = params.serviceId.trim();
  const officeId = params.officeId.trim();
  const counselorId = params.counselorId.trim();

  if (!name || !email || !serviceId || !officeId || !counselorId) {
    return { error: "Missing required fields" };
  }

  const { data: counselor, error: counselorErr } = await admin
    .from("counselors")
    .select("id, office_id, user_id")
    .eq("id", counselorId)
    .maybeSingle();

  if (counselorErr || !counselor || counselor.office_id !== officeId) {
    return { error: "Counselor must belong to the selected office" };
  }

  const { data: service, error: serviceErr } = await admin
    .from("services")
    .select("id")
    .eq("id", serviceId)
    .maybeSingle();

  if (serviceErr || !service) {
    return { error: "Invalid service" };
  }

  const { data: firstMilestone, error: msErr } = await admin
    .from("service_milestones")
    .select("id")
    .eq("service_id", serviceId)
    .order("order_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (msErr || !firstMilestone) {
    return {
      error: "This service has no milestones yet. Add milestones before assigning clients.",
    };
  }

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: name },
  });

  if (inviteErr || !invited.user) {
    const msg = inviteErr?.message ?? "Could not invite user";
    return { error: msg };
  }

  const newUserId = invited.user.id;

  const { error: profileErr } = await admin
    .from("profiles")
    .update({ full_name: name })
    .eq("id", newUserId);

  if (profileErr) {
    await admin.auth.admin.deleteUser(newUserId);
    return { error: profileErr.message ?? "Could not update profile" };
  }

  const clientResult = await insertClientRecord(admin, {
    authUserId: newUserId,
    serviceId,
    stageId: firstMilestone.id,
    officeId,
    counselorRowId: counselorId,
    counselorLoginId: counselor.user_id,
    contactEmail: email,
  });

  if ("error" in clientResult) {
    await admin.auth.admin.deleteUser(newUserId);
    return { error: clientResult.error };
  }

  if (params.esUserId?.trim()) {
    const { error: assignErr } = await admin.from("es_client_assignments").insert({
      es_user_id: params.esUserId.trim(),
      client_id: clientResult.id,
    });

    if (assignErr) {
      await admin.from("clients").delete().eq("id", clientResult.id);
      await admin.auth.admin.deleteUser(newUserId);
      return { error: assignErr.message ?? "Could not assign client to ES" };
    }
  }

  return { clientId: clientResult.id };
}
