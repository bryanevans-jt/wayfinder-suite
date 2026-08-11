"use server";

import { isApplicationStatus } from "@wayfinder/branding";
import {
  buildClientActivityInsertFkIds,
  insertApplicationForClient,
  insertEsTimeEntry,
  todayLocalDate,
} from "@wayfinder/supabase";
import {
  type ActionResult,
  finishActionFailure,
  friendlyApplicationSaveError,
} from "@wayfinder/supabase/error-log";
import { assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { revalidatePath } from "next/cache";
import { assertStaffClientWriteAccess } from "@/lib/es-client-access";
import { saveClientContactLog } from "@/lib/save-client-contact-log";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { processEmploymentCelebration } from "@wayfinder/supabase/employment-celebrations";
import { clientDisplayName } from "@wayfinder/branding";
import { isTerminalStageTitle } from "@wayfinder/supabase/client-archive";

function revalidateClientPaths(clientId: string) {
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${clientId}`);
  revalidatePath("/dashboard/counselor");
  revalidatePath(`/dashboard/counselor/clients/${clientId}`);
  revalidatePath("/dashboard/timesheet");
  revalidatePath("/dashboard/supervisor");
}

async function clientFkIds(
  admin: Awaited<ReturnType<typeof assertStaffClientWriteAccess>>["admin"],
  clientId: string
): Promise<string[]> {
  const { data: clientRow } = await admin
    .from("clients")
    .select("id, user_id, profile_id")
    .eq("id", clientId)
    .maybeSingle();
  return clientRow ? buildClientActivityInsertFkIds(clientRow) : [clientId];
}

type TimeInput = {
  activityTypeId: string;
  durationMinutes: number;
  serviceDate?: string;
  narrative?: string | null;
};

export async function addClientContactLog(
  clientId: string,
  contactNotes: string,
  internalNotes: string,
  time?: TimeInput
): Promise<ActionResult> {
  let actorUserId: string | undefined;

  try {
    await assertNotPreviewMutation();
    const { admin, userId } = await assertStaffClientWriteAccess(clientId);
    actorUserId = userId;

    const result = await saveClientContactLog(admin, userId, {
      clientId,
      contactNotes,
      internalNotes,
      time,
    });

    if (!result.ok) {
      return result;
    }

    revalidateClientPaths(clientId);
    return result;
  } catch (err) {
    return await finishActionFailure(
      "staff",
      "actions/addClientContactLog",
      err,
      { userId: actorUserId },
      "We could not save this contact log."
    );
  }
}

export async function updateClientCurrentStage(clientId: string, milestoneId: string) {
  await assertNotPreviewMutation();
  const { admin } = await assertStaffClientWriteAccess(clientId);

  const { data: client, error: clientErr } = await admin
    .from("clients")
    .select("id, current_service_id, current_stage_id, full_name, contact_email")
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client?.current_service_id) {
    throw new Error("Client not found or has no service");
  }

  const { data: milestone, error: msErr } = await admin
    .from("service_milestones")
    .select("id, title")
    .eq("id", milestoneId)
    .eq("service_id", client.current_service_id)
    .maybeSingle();

  if (msErr || !milestone) {
    throw new Error("Invalid milestone for this client’s service");
  }

  const prevStageId = client.current_stage_id as string | null;
  let prevTitle = "";
  if (prevStageId) {
    const { data: prev } = await admin
      .from("service_milestones")
      .select("title")
      .eq("id", prevStageId)
      .maybeSingle();
    prevTitle = String(prev?.title ?? "");
  }

  const { error: updErr } = await admin
    .from("clients")
    .update({
      current_stage_id: milestoneId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  if (updErr) {
    throw new Error(updErr.message ?? "Update failed");
  }

  const nextTitle = String(milestone.title ?? "");
  const fromPhase1 = /phase\s*1\s*:\s*intake/i.test(prevTitle);
  const toPhase2 = /phase\s*2\s*:\s*job\s*development/i.test(nextTitle);
  if (fromPhase1 && toPhase2) {
    const { data: service } = await admin
      .from("services")
      .select("name")
      .eq("id", client.current_service_id)
      .maybeSingle();
    if ((service?.name as string) === "Traditional Supported Employment (GA)") {
      const { markIntakeReadyToBill } = await import("@wayfinder/supabase/intake-billing");
      await markIntakeReadyToBill(admin, { clientId, reason: "tse_phase" });
    }
  }

  revalidateClientPaths(clientId);
}

/** Restore Closed/Dismissed/archived client to the first active stage for their service. */
export async function restoreArchivedClient(clientId: string) {
  await assertNotPreviewMutation();
  const { admin } = await assertStaffClientWriteAccess(clientId);

  const { data: client, error: clientErr } = await admin
    .from("clients")
    .select("id, current_service_id, archived_at")
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client) {
    throw new Error("Client not found");
  }
  if (!client.current_service_id) {
    throw new Error("Client has no service; assign a service before restoring.");
  }
  if (!client.archived_at) {
    throw new Error("Client is not closed or archived.");
  }

  const { data: milestones, error: mErr } = await admin
    .from("service_milestones")
    .select("id, title, order_index")
    .eq("service_id", client.current_service_id)
    .order("order_index", { ascending: true });
  if (mErr) throw new Error(mErr.message);

  const active = (milestones ?? []).find((m) => !isTerminalStageTitle(String(m.title)));
  if (!active) {
    throw new Error("No active stage found for this service.");
  }

  const { error: updErr } = await admin
    .from("clients")
    .update({ current_stage_id: active.id })
    .eq("id", clientId);
  if (updErr) throw new Error(updErr.message ?? "Restore failed");

  revalidateClientPaths(clientId);
}

export async function addClientApplication(
  clientId: string,
  status: string,
  companyName: string,
  notes: string,
  statusOtherReason: string | null = null,
  employerId: string | null = null
): Promise<ActionResult> {
  let actorUserId: string | undefined;

  try {
    await assertNotPreviewMutation();
    const normalized = status.trim();
    const company = companyName.trim();
    if (!normalized || !isApplicationStatus(normalized)) {
      return { ok: false, error: "Application status is required." };
    }
    if (normalized === "Other" && !statusOtherReason?.trim()) {
      return { ok: false, error: "Reason is required when status is Other." };
    }
    if (!company && !employerId) {
      return { ok: false, error: "Select an employer from the network or enter a company name." };
    }

    const { admin, userId } = await assertStaffClientWriteAccess(clientId);
    actorUserId = userId;

    let resolvedCompany = company;
    const normalizedEmployerId = employerId?.trim() || null;
    if (normalizedEmployerId) {
      const { data: employer } = await admin
        .from("employers")
        .select("name")
        .eq("id", normalizedEmployerId)
        .maybeSingle();
      if (employer?.name) {
        resolvedCompany = employer.name as string;
      }
    }

    if (!resolvedCompany) {
      return { ok: false, error: "Company name is required." };
    }

    const fkIds = await clientFkIds(admin, clientId);

    await insertApplicationForClient(admin, fkIds, {
      status: normalized,
      company_name: resolvedCompany,
      notes: notes.trim() || null,
      status_other_reason: normalized === "Other" ? statusOtherReason?.trim() ?? null : null,
      employer_id: normalizedEmployerId,
    });

    revalidateClientPaths(clientId);
    return { ok: true };
  } catch (err) {
    const hint =
      err instanceof Error
        ? friendlyApplicationSaveError(err.message)
        : "We could not save this application.";
    return await finishActionFailure(
      "staff",
      "actions/addClientApplication",
      err,
      { userId: actorUserId },
      hint
    );
  }
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

  const { admin } = await assertStaffClientWriteAccess(clientId);

  const { error } = await admin
    .from("applications")
    .update({
      status: normalized,
      status_other_reason: normalized === "Other" ? statusOtherReason?.trim() ?? null : null,
    })
    .eq("id", applicationId)
    .in("client_id", await clientFkIds(admin, clientId));

  if (error) {
    throw new Error(error.message);
  }

  revalidateClientPaths(clientId);
}

export async function setClientJobStartDate(
  clientId: string,
  jobStartDate: string
): Promise<ActionResult> {
  let actorUserId: string | undefined;

  try {
    await assertNotPreviewMutation();
    const trimmed = jobStartDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return { ok: false, error: "Enter a valid job start date." };
    }

    const { admin, userId } = await assertStaffClientWriteAccess(clientId);
    actorUserId = userId;

    const { error } = await admin
      .from("clients")
      .update({ job_start_date: trimmed })
      .eq("id", clientId);

    if (error) {
      return { ok: false, error: error.message };
    }

    const { data: clientRow } = await admin
      .from("clients")
      .select("contact_email, full_name, user_id, profile_id")
      .eq("id", clientId)
      .maybeSingle();

    const profileId = (clientRow?.user_id ?? clientRow?.profile_id) as string | null;
    let clientLabel = clientDisplayName({
      full_name: (clientRow?.full_name as string | null) ?? null,
      contact_email: clientRow?.contact_email as string | null,
      id: clientId,
    });
    if (profileId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", profileId)
        .maybeSingle();
      clientLabel = clientDisplayName({
        full_name:
          (profile?.full_name as string | null) ??
          (clientRow?.full_name as string | null) ??
          null,
        contact_email: clientRow?.contact_email as string | null,
        id: clientId,
      });
    }

    try {
      const celebrationAdmin = createServiceRoleClient();
      await processEmploymentCelebration(
        celebrationAdmin,
        clientId,
        "hire",
        trimmed,
        clientLabel
      );
    } catch (err) {
      console.error("hire celebration failed:", err);
    }

    revalidateClientPaths(clientId);
    return { ok: true };
  } catch (err) {
    return finishActionFailure(
      "staff",
      "actions/setClientJobStartDate",
      err,
      { userId: actorUserId },
      "We could not save the job start date."
    );
  }
}
