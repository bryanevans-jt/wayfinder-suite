import type { SupabaseClient } from "@supabase/supabase-js";
import { insertClientRecord } from "./client-insert";
import { insertRosterClientRecord } from "./client-roster-insert";
import {
  findClientIdByName,
  loadClientIdsByNormalizedName,
  loadClientIdByContactEmail,
} from "./client-name-dedupe";
import { resolveAuthUserIdByEmail } from "./link-client-auth";

export type CreateClientParams = {
  name: string;
  /** Optional — when omitted the client is created without a login (roster mode). */
  email?: string;
  serviceId: string;
  officeId: string;
  counselorId: string;
  esUserId?: string;
};

export async function createClientWithInvite(
  admin: SupabaseClient,
  params: CreateClientParams
): Promise<{ clientId: string } | { error: string }> {
  return createClientAccount(admin, { ...params, sendInvite: true });
}

export type CreateClientAccountParams = CreateClientParams & {
  /** When false, creates a login without sending email (bulk onboarding). Default true. */
  sendInvite?: boolean;
};

export async function createClientAccount(
  admin: SupabaseClient,
  params: CreateClientAccountParams
): Promise<{ clientId: string } | { error: string }> {
  const name = params.name.trim();
  const email = (params.email ?? "").trim().toLowerCase();
  const serviceId = params.serviceId.trim();
  const officeId = params.officeId.trim();
  const counselorId = params.counselorId.trim();
  const sendInvite = params.sendInvite !== false;

  if (!name || !serviceId || !officeId || !counselorId) {
    return { error: "Missing required fields" };
  }

  const counselorOk = await counselorBelongsToOffice(admin, counselorId, officeId);
  if (!counselorOk) {
    return { error: "Counselor must belong to the selected office" };
  }

  const { data: counselor, error: counselorErr } = await admin
    .from("counselors")
    .select("id, office_id, user_id")
    .eq("id", counselorId)
    .maybeSingle();

  if (counselorErr || !counselor) {
    return { error: "Invalid counselor" };
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

  const existingByName = await loadClientIdsByNormalizedName(admin);
  const existingByNameId = findClientIdByName(existingByName, name);
  if (existingByNameId) {
    if (params.esUserId?.trim()) {
      const { error: assignErr } = await admin.from("es_client_assignments").upsert(
        { es_user_id: params.esUserId.trim(), client_id: existingByNameId },
        { onConflict: "es_user_id,client_id" }
      );
      if (assignErr) {
        return { error: assignErr.message ?? "Could not assign client to ES" };
      }
    }
    return { clientId: existingByNameId };
  }

  if (email) {
    const existingEmailId = await loadClientIdByContactEmail(admin, email);
    if (existingEmailId) {
      if (params.esUserId?.trim()) {
        const { error: assignErr } = await admin.from("es_client_assignments").upsert(
          { es_user_id: params.esUserId.trim(), client_id: existingEmailId },
          { onConflict: "es_user_id,client_id" }
        );
        if (assignErr) {
          return { error: assignErr.message ?? "Could not assign client to ES" };
        }
      }
      return { clientId: existingEmailId };
    }
  }

  if (!email) {
    const clientResult = await insertRosterClientRecord(admin, {
      fullName: name,
      counselorId,
      officeId,
      serviceId,
      stageId: firstMilestone.id as string,
    });

    if ("error" in clientResult) {
      return { error: clientResult.error };
    }

    if (params.esUserId?.trim()) {
      const { error: assignErr } = await admin.from("es_client_assignments").insert({
        es_user_id: params.esUserId.trim(),
        client_id: clientResult.id,
      });

      if (assignErr) {
        await admin.from("clients").delete().eq("id", clientResult.id);
        return { error: assignErr.message ?? "Could not assign client to ES" };
      }
    }

    return { clientId: clientResult.id };
  }

  const authResult = await provisionClientAuthUser(admin, email, name, sendInvite);
  if ("error" in authResult) {
    return authResult;
  }

  const newUserId = authResult.userId;

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
    if (authResult.created) {
      await admin.auth.admin.deleteUser(newUserId);
    }
    return { error: clientResult.error };
  }

  if (params.esUserId?.trim()) {
    const { error: assignErr } = await admin.from("es_client_assignments").insert({
      es_user_id: params.esUserId.trim(),
      client_id: clientResult.id,
    });

    if (assignErr) {
      await admin.from("clients").delete().eq("id", clientResult.id);
      if (authResult.created) {
        await admin.auth.admin.deleteUser(newUserId);
      }
      return { error: assignErr.message ?? "Could not assign client to ES" };
    }
  }

  return { clientId: clientResult.id };
}

async function provisionClientAuthUser(
  admin: SupabaseClient,
  email: string,
  name: string,
  sendInvite: boolean
): Promise<{ userId: string; created: boolean } | { error: string }> {
  if (sendInvite) {
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

    return { userId: newUserId, created: true };
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Could not create user";
    if (/already|registered|exists/i.test(msg)) {
      return { error: "Email already registered" };
    }
    return { error: msg };
  }

  const newUserId = created.user.id;
  const { error: profileErr } = await admin
    .from("profiles")
    .update({ full_name: name, role: "client" })
    .eq("id", newUserId);

  if (profileErr) {
    await admin.auth.admin.deleteUser(newUserId);
    return { error: profileErr.message ?? "Could not update profile" };
  }

  return { userId: newUserId, created: true };
}

/** Creates or resolves a client login for an email (used when email is added to a roster client). */
export async function ensureClientLoginForEmail(
  admin: SupabaseClient,
  email: string,
  fullName: string,
  options: { sendInvite?: boolean } = {}
): Promise<{ userId: string; created: boolean } | { error: string }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { error: "Email is required" };
  }

  const existingId = await resolveAuthUserIdByEmail(admin, normalized);
  if (existingId) {
    const { error: profileErr } = await admin
      .from("profiles")
      .update({ full_name: fullName.trim(), role: "client", is_active: true })
      .eq("id", existingId);

    if (profileErr) {
      return { error: profileErr.message ?? "Could not update profile" };
    }

    return { userId: existingId, created: false };
  }

  return provisionClientAuthUser(admin, normalized, fullName, options.sendInvite !== false);
}

async function counselorBelongsToOffice(
  admin: SupabaseClient,
  counselorId: string,
  officeId: string
): Promise<boolean> {
  const { data: counselor } = await admin
    .from("counselors")
    .select("id, office_id")
    .eq("id", counselorId)
    .maybeSingle();

  if (!counselor) return false;
  if (counselor.office_id === officeId) return true;

  const { data: link } = await admin
    .from("counselor_office_assignments")
    .select("id")
    .eq("counselor_id", counselorId)
    .eq("office_id", officeId)
    .maybeSingle();

  return Boolean(link);
}
