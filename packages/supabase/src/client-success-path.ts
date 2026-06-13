import { serviceDisplayName } from "@wayfinder/branding";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SuccessPathMilestone = {
  id: string;
  order_index: number;
  title: string;
  description: string | null;
};

export type ClientSuccessPathView = {
  serviceId: string;
  serviceName: string;
  milestones: SuccessPathMilestone[];
  currentStageId: string | null;
  currentStageTitle: string | null;
};

type ClientServiceRow = {
  current_service_id: string | null;
  current_stage_id: string | null;
};

const MILESTONE_SELECT = "id, order_index, title, description";

async function loadMilestonesForService(
  supabase: SupabaseClient,
  serviceId: string
): Promise<SuccessPathMilestone[]> {
  const { data } = await supabase
    .from("service_milestones")
    .select(MILESTONE_SELECT)
    .eq("service_id", serviceId)
    .order("order_index", { ascending: true });

  return (data ?? []) as SuccessPathMilestone[];
}

async function loadServiceName(
  supabase: SupabaseClient,
  serviceId: string
): Promise<string | null> {
  const withState = await supabase
    .from("services")
    .select("id, name, state")
    .eq("id", serviceId)
    .maybeSingle();

  if (!withState.error && withState.data) {
    return serviceDisplayName({
      id: withState.data.id as string,
      name: withState.data.name as string,
      state: (withState.data.state as string | null) ?? null,
    });
  }

  const basic = await supabase.from("services").select("name").eq("id", serviceId).maybeSingle();
  return (basic.data?.name as string | undefined) ?? null;
}

/** Loads service + milestone trail for the client portal (respects RLS as the signed-in user). */
export async function loadClientSuccessPath(
  supabase: SupabaseClient,
  clientRow: ClientServiceRow
): Promise<ClientSuccessPathView | null> {
  let serviceId = clientRow.current_service_id;
  if (!serviceId && !clientRow.current_stage_id) {
    return null;
  }

  let milestones: SuccessPathMilestone[] = [];
  if (serviceId) {
    milestones = await loadMilestonesForService(supabase, serviceId);
  }

  if (milestones.length === 0 && clientRow.current_stage_id) {
    const { data: stageRow } = await supabase
      .from("service_milestones")
      .select("id, service_id, title")
      .eq("id", clientRow.current_stage_id)
      .maybeSingle();

    const stageServiceId = stageRow?.service_id as string | undefined;
    if (stageServiceId) {
      serviceId = stageServiceId;
      milestones = await loadMilestonesForService(supabase, stageServiceId);
    }
  }

  if (!serviceId) {
    return null;
  }

  const serviceName = (await loadServiceName(supabase, serviceId)) ?? "Your Wayfinder service";
  const currentStage = milestones.find((m) => m.id === clientRow.current_stage_id) ?? null;

  return {
    serviceId,
    serviceName,
    milestones,
    currentStageId: clientRow.current_stage_id,
    currentStageTitle: currentStage?.title ?? null,
  };
}
