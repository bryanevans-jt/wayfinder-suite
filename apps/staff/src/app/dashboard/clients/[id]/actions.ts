"use server";

import { isApplicationStatus } from "@wayfinder/branding";
import {
  insertApplicationForClient,
  insertContactLogForClient,
  loadClientActivityFkContext,
} from "@wayfinder/supabase";
import { assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { revalidatePath } from "next/cache";
import { assertEsAssignedToClient } from "@/lib/es-client-access";

function revalidateClientPaths(clientId: string) {
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/counselor");
  revalidatePath(`/dashboard/counselor/clients/${clientId}`);
}

export async function updateClientCurrentStage(clientId: string, milestoneId: string) {
  await assertNotPreviewMutation();
  const { supabase } = await assertEsAssignedToClient(clientId);

  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, current_service_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client?.current_service_id) {
    throw new Error("Client not found or has no service");
  }

  const { data: milestone, error: msErr } = await supabase
    .from("service_milestones")
    .select("id")
    .eq("id", milestoneId)
    .eq("service_id", client.current_service_id)
    .maybeSingle();

  if (msErr || !milestone) {
    throw new Error("Invalid milestone for this client’s service");
  }

  const { error: updErr } = await supabase
    .from("clients")
    .update({ current_stage_id: milestoneId })
    .eq("id", clientId);

  if (updErr) {
    throw new Error(updErr.message ?? "Update failed");
  }

  revalidateClientPaths(clientId);
}

export async function addClientContactLog(
  clientId: string,
  publicOutcome: string,
  notes: string
) {
  await assertNotPreviewMutation();
  const outcome = publicOutcome.trim();
  if (!outcome) {
    throw new Error("Public outcome is required");
  }

  const { supabase, userId } = await assertEsAssignedToClient(clientId);

  const fkContext = await loadClientActivityFkContext(supabase, clientId);
  if (!fkContext) {
    throw new Error("Client not found");
  }

  await insertContactLogForClient(supabase, {
    loggedBy: userId,
    fkIds: fkContext.fkIds,
    outcome,
    notes: notes.trim() || null,
  });

  revalidateClientPaths(clientId);
}

export async function addClientApplication(
  clientId: string,
  status: string,
  companyName: string,
  notes: string,
  statusOtherReason: string | null = null,
  employerId: string | null = null
) {
  await assertNotPreviewMutation();
  const normalized = status.trim();
  const company = companyName.trim();
  if (!normalized || !isApplicationStatus(normalized)) {
    throw new Error("Application status is required");
  }
  if (normalized === "Other" && !statusOtherReason?.trim()) {
    throw new Error("Reason is required when status is Other");
  }
  if (!company && !employerId) {
    throw new Error("Company or employer is required");
  }

  const { supabase } = await assertEsAssignedToClient(clientId);

  const fkContext = await loadClientActivityFkContext(supabase, clientId);
  if (!fkContext) {
    throw new Error("Client not found");
  }

  let resolvedCompany = company;
  if (employerId) {
    const { data: employer } = await supabase
      .from("employers")
      .select("name")
      .eq("id", employerId)
      .maybeSingle();
    if (employer?.name) {
      resolvedCompany = employer.name as string;
    }
  }

  if (!resolvedCompany) {
    throw new Error("Company name is required");
  }

  await insertApplicationForClient(supabase, [fkContext.clientId], {
    status: normalized,
    company_name: resolvedCompany,
    notes: notes.trim() || null,
    status_other_reason: normalized === "Other" ? statusOtherReason?.trim() ?? null : null,
    employer_id: employerId,
  });

  revalidateClientPaths(clientId);
}

export async function updateClientApplication(
  clientId: string,
  applicationId: string,
  status: string,
  statusOtherReason: string | null
) {
  await assertNotPreviewMutation();
  const normalized = status.trim();
  if (!isApplicationStatus(normalized)) {
    throw new Error("Invalid status");
  }
  if (normalized === "Other" && !statusOtherReason?.trim()) {
    throw new Error("Reason is required when status is Other");
  }

  const { supabase } = await assertEsAssignedToClient(clientId);

  const { error } = await supabase
    .from("applications")
    .update({
      status: normalized,
      status_other_reason: normalized === "Other" ? statusOtherReason?.trim() ?? null : null,
    })
    .eq("id", applicationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidateClientPaths(clientId);
}
