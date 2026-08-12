import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUser } from "./notify-user";
import { isAccountantRole, isAdminTierRole, isHrRole, normalizeRole } from "./roles";

export type IntakeBillingStatus = "scheduled" | "ready_to_bill" | "billed" | "paid";
export type IntakeReadyReason = "contact_log" | "tse_phase" | "scheduled_time" | "manual";

export function canAccessIntakeBilling(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return isAccountantRole(r) || isHrRole(r) || isAdminTierRole(r);
}

export { isAccountantRole } from "./roles";

type BillingRow = {
  id: string;
  client_id: string;
  status: IntakeBillingStatus;
  scheduled_at: string | null;
};

async function loadBilling(
  admin: SupabaseClient,
  clientId: string
): Promise<BillingRow | null> {
  const { data, error } = await admin
    .from("intake_billings")
    .select("id, client_id, status, scheduled_at")
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    console.error("intake_billings load failed:", error.message);
    return null;
  }
  return (data as BillingRow | null) ?? null;
}

async function clientLabel(admin: SupabaseClient, clientId: string): Promise<string> {
  const { data } = await admin
    .from("clients")
    .select("full_name, contact_email, user_id, profile_id")
    .eq("id", clientId)
    .maybeSingle();
  const roster = (data?.full_name as string | null)?.trim() || null;
  if (roster) return roster;

  const authId =
    ((data?.user_id as string | null) ?? (data?.profile_id as string | null)) || null;
  if (authId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", authId)
      .maybeSingle();
    const profileName = (profile?.full_name as string | null)?.trim() || null;
    if (profileName) return profileName;
  }

  return (data?.contact_email as string | null)?.trim() || "Client";
}

async function notifyAccountsReady(admin: SupabaseClient, clientId: string): Promise<void> {
  const label = await clientLabel(admin, clientId);
  const { data: accountants } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "accountant")
    .eq("is_active", true);
  await Promise.all(
    (accountants ?? []).map((row) =>
      notifyUser(admin, {
        userId: row.id as string,
        app: "staff",
        kind: "referral_intake_billing",
        title: `Bill intake: ${label}`,
        body: "Intake meeting is complete. Bill the state, then mark payment received.",
        link_path: "/dashboard/intake-billing",
        metadata: { clientId },
      })
    )
  );
}

export async function ensureScheduledIntakeBilling(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    hospitalityTaskId?: string | null;
    scheduledAt?: string | null;
  }
): Promise<{ id: string } | { error: string }> {
  const existing = await loadBilling(admin, opts.clientId);
  const scheduledAt = (opts.scheduledAt ?? "").trim() || null;
  if (existing) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (opts.hospitalityTaskId) patch.hospitality_task_id = opts.hospitalityTaskId;
    if (scheduledAt && !existing.scheduled_at) patch.scheduled_at = scheduledAt;
    await admin.from("intake_billings").update(patch).eq("id", existing.id);
    return { id: existing.id };
  }

  const { data, error } = await admin
    .from("intake_billings")
    .insert({
      client_id: opts.clientId,
      hospitality_task_id: opts.hospitalityTaskId ?? null,
      status: "scheduled",
      scheduled_at: scheduledAt,
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    return { error: error?.message ?? "Could not create intake billing" };
  }
  return { id: data.id as string };
}

export async function markIntakeReadyToBill(
  admin: SupabaseClient,
  opts: { clientId: string; reason: IntakeReadyReason }
): Promise<{ ready: boolean; already?: boolean; error?: string }> {
  let row = await loadBilling(admin, opts.clientId);
  if (!row) {
    const created = await ensureScheduledIntakeBilling(admin, { clientId: opts.clientId });
    if ("error" in created) return { ready: false, error: created.error };
    row = await loadBilling(admin, opts.clientId);
    if (!row) return { ready: false, error: "Could not load intake billing" };
  }

  if (row.status === "ready_to_bill" || row.status === "billed" || row.status === "paid") {
    return { ready: false, already: true };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("intake_billings")
    .update({
      status: "ready_to_bill",
      ready_at: now,
      ready_reason: opts.reason,
      updated_at: now,
    })
    .eq("id", row.id)
    .eq("status", "scheduled");
  if (error) return { ready: false, error: error.message };

  await notifyAccountsReady(admin, opts.clientId);
  return { ready: true };
}

export async function markIntakeReadyIfHospitalityComplete(
  admin: SupabaseClient,
  opts: { clientId: string; reason: IntakeReadyReason }
): Promise<void> {
  const { data: task } = await admin
    .from("hospitality_intake_tasks")
    .select("status")
    .eq("client_id", opts.clientId)
    .maybeSingle();
  const billing = await loadBilling(admin, opts.clientId);
  if (task?.status !== "completed" && !billing) return;
  await markIntakeReadyToBill(admin, opts);
}

export async function markDueScheduledIntakeBillings(
  admin: SupabaseClient
): Promise<{ marked: number }> {
  const now = new Date().toISOString();
  const { data: due } = await admin
    .from("intake_billings")
    .select("client_id")
    .eq("status", "scheduled")
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", now)
    .limit(200);

  const results = await Promise.all(
    (due ?? []).map((row) =>
      markIntakeReadyToBill(admin, {
        clientId: row.client_id as string,
        reason: "scheduled_time",
      })
    )
  );
  return { marked: results.filter((r) => r.ready).length };
}

export async function updateIntakeBillingStatus(
  admin: SupabaseClient,
  opts: {
    billingId: string;
    action: "billed" | "paid" | "ready";
    actorUserId: string;
  }
): Promise<{ ok: true } | { error: string }> {
  const { data: row, error: loadErr } = await admin
    .from("intake_billings")
    .select("id, status")
    .eq("id", opts.billingId)
    .maybeSingle();
  if (loadErr || !row) return { error: loadErr?.message ?? "Billing record not found" };

  const now = new Date().toISOString();
  if (opts.action === "ready") {
    if (row.status !== "scheduled") return { error: "Only scheduled intakes can be marked ready" };
    const { data: full } = await admin
      .from("intake_billings")
      .select("client_id")
      .eq("id", opts.billingId)
      .maybeSingle();
    if (!full?.client_id) return { error: "Client missing" };
    const result = await markIntakeReadyToBill(admin, {
      clientId: full.client_id as string,
      reason: "manual",
    });
    if (result.error) return { error: result.error };
    return { ok: true };
  }

  if (opts.action === "billed") {
    if (row.status !== "ready_to_bill") return { error: "Mark ready-to-bill items as billed" };
    const { error } = await admin
      .from("intake_billings")
      .update({
        status: "billed",
        billed_at: now,
        billed_by: opts.actorUserId,
        updated_at: now,
      })
      .eq("id", opts.billingId);
    if (error) return { error: error.message };
    return { ok: true };
  }

  if (row.status !== "billed") return { error: "Mark billed items as paid" };
  const { error } = await admin
    .from("intake_billings")
    .update({
      status: "paid",
      paid_at: now,
      paid_by: opts.actorUserId,
      updated_at: now,
    })
    .eq("id", opts.billingId);
  if (error) return { error: error.message };
  return { ok: true };
}
