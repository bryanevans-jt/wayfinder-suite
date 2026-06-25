import { createClientAccount } from "@wayfinder/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildClientActivityFkIds } from "@wayfinder/supabase";

export type DemoClientRow = {
  id: string;
  contact_email: string | null;
  clientUserId: string | null;
  esUserId: string | null;
  esName: string | null;
  clientName: string | null;
  created_at: string;
};

export async function listDemoClients(admin: SupabaseClient): Promise<DemoClientRow[]> {
  const { data: clients } = await admin
    .from("clients")
    .select("id, contact_email, user_id, profile_id, created_at")
    .eq("is_demo", true)
    .order("created_at", { ascending: false });

  if (!clients?.length) {
    return [];
  }

  const clientIds = clients.map((c) => c.id as string);
  const { data: assignments } = await admin
    .from("es_client_assignments")
    .select("client_id, es_user_id")
    .in("client_id", clientIds);

  const esByClient = new Map(
    (assignments ?? []).map((a) => [a.client_id as string, a.es_user_id as string])
  );

  const esIds = [...new Set((assignments ?? []).map((a) => a.es_user_id as string))];
  const userIds = [
    ...new Set(
      clients
        .flatMap((c) => [c.user_id, c.profile_id] as (string | null)[])
        .filter(Boolean) as string[]
    ),
    ...esIds,
  ];

  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, full_name, first_name, last_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null; first_name?: string | null; last_name?: string | null }[] };

  const nameById = new Map(
    (profiles ?? []).map((p) => {
      const name =
        (p.full_name as string | null)?.trim() ||
        [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
        null;
      return [p.id as string, name];
    })
  );

  return clients.map((c) => {
    const clientUserId = (c.user_id ?? c.profile_id) as string | null;
    const esUserId = esByClient.get(c.id as string) ?? null;
    return {
      id: c.id as string,
      contact_email: c.contact_email as string | null,
      clientUserId,
      esUserId,
      esName: esUserId ? nameById.get(esUserId) ?? null : null,
      clientName:
        (clientUserId ? nameById.get(clientUserId) : null) ??
        (c.contact_email as string | null) ??
        "Demo client",
      created_at: c.created_at as string,
    };
  });
}

export async function createDemoClient(
  admin: SupabaseClient,
  input: {
    name: string;
    email: string;
    serviceId: string;
    officeId: string;
    counselorId: string;
    esUserId: string;
    createdBy: string;
  }
): Promise<{ clientId: string } | { error: string }> {
  const result = await createClientAccount(admin, {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    serviceId: input.serviceId,
    officeId: input.officeId,
    counselorId: input.counselorId,
    esUserId: input.esUserId,
    sendInvite: false,
  });

  if ("error" in result) {
    return result;
  }

  const { error: demoErr } = await admin
    .from("clients")
    .update({
      is_demo: true,
      demo_created_by: input.createdBy,
    })
    .eq("id", result.clientId);

  if (demoErr) {
    return { error: demoErr.message ?? "Could not mark client as demo" };
  }

  return { clientId: result.clientId };
}

/** Remove activity data for demo clients so analytics and alerts reset. */
export async function clearDemoTrainingMetrics(admin: SupabaseClient): Promise<{ clearedClients: number }> {
  const { data: demoClients } = await admin.from("clients").select("id, user_id, profile_id").eq("is_demo", true);

  const clientIds = (demoClients ?? []).map((c) => c.id as string);
  if (clientIds.length === 0) {
    return { clearedClients: 0 };
  }

  const fkIds = new Set<string>();
  for (const c of demoClients ?? []) {
    for (const id of buildClientActivityFkIds({
      id: c.id as string,
      user_id: c.user_id as string | null,
      profile_id: c.profile_id as string | null,
    })) {
      fkIds.add(id);
    }
  }
  const fkList = [...fkIds];

  if (fkList.length > 0) {
    await admin.from("contact_logs").delete().in("client_id", fkList);
    await admin.from("applications").delete().in("client_id", fkList);
    await admin.from("meetings").delete().in("client_id", fkList);
    await admin.from("es_time_entries").delete().in("client_id", fkList);
    await admin.from("client_message_threads").delete().in("client_id", fkList);
  }

  await admin.from("report_dashboard_alerts").delete().in("wayfinder_client_id", clientIds);

  return { clearedClients: clientIds.length };
}
