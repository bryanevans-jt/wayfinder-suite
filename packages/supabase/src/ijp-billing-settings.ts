import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAdminRole,
  isAccountantRole,
  isSuperAdminRole,
  normalizeRole,
} from "./roles";

export type IjpBillingSettingsRow = {
  id: string;
  module_enabled: boolean;
  provider_name: string;
  remit_address: string;
  hourly_rate_cents: number;
  ga_ijp_service_id: string | null;
  template_invoice_doc_id: string | null;
  template_attestation_doc_id: string | null;
  drive_attestation_folder_id: string | null;
  drive_invoice_folder_id: string | null;
  drive_test_attestation_folder_id: string | null;
  drive_test_invoice_folder_id: string | null;
  drive_signature_temp_folder_id: string | null;
  updated_at: string;
};

export const GA_IJP_SERVICE_NAME = "Individual Job Placement (GA)";

export const DEFAULT_IJP_INVOICE_DOC_ID = "1mm4mg-6usruEv6E6lZEV6Y3o0IuuKw_rACaoXX08G-g";
export const DEFAULT_IJP_ATTESTATION_DOC_ID = "1r8ekYATmXRbfAxNOQJd_sWJwbprUU9A17Gou7fKvVHE";

export async function loadIjpBillingSettings(
  admin: SupabaseClient
): Promise<IjpBillingSettingsRow> {
  const { data, error } = await admin.from("ijp_billing_settings").select("*").limit(1).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("ijp_billing_settings row missing");
  }
  return data as IjpBillingSettingsRow;
}

export async function resolveGaIjpServiceId(admin: SupabaseClient): Promise<string | null> {
  const settings = await loadIjpBillingSettings(admin);
  if (settings.ga_ijp_service_id) {
    return settings.ga_ijp_service_id;
  }
  const { data } = await admin
    .from("services")
    .select("id")
    .eq("name", GA_IJP_SERVICE_NAME)
    .eq("state", "GA")
    .maybeSingle();
  return (data?.id as string) ?? null;
}

/**
 * Add / edit IJP Billing invoice rows (create, patch line hours / billing fields).
 * Accounts Specialist (`accountant`), Admin, and Super Admin.
 * Does not include delete, settings, bulk generate, or sandbox test tools.
 */
export function canEditIjpBilling(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (isSuperAdminRole(r)) return true;
  if (isAdminRole(r)) return true;
  if (isAccountantRole(r)) return true;
  return false;
}

/** IJP Billing workspace — same roles as edit (no view-only role today). */
export function canAccessIjpBilling(role: string | null | undefined): boolean {
  return canEditIjpBilling(role);
}

export function canManageIjpBillingSettings(role: string | null | undefined): boolean {
  return isSuperAdminRole(role);
}

/**
 * Whether line-item / invoice field edits are locked by invoice lifecycle.
 * Current product rules do not lock draft, ready, or archived for PATCH — keep UI aligned.
 */
export function isIjpInvoiceLockedForLineEdits(invoice: {
  status?: string | null;
  compiled_at?: string | null;
  archived_at?: string | null;
} | null | undefined): boolean {
  void invoice;
  return false;
}

/** How the list Hours cell expansion behaves for the current viewer. */
export type IjpHoursExpandMode = "edit" | "readonly";

export function ijpHoursExpandMode(opts: {
  canEdit: boolean;
  locked?: boolean;
}): IjpHoursExpandMode {
  if (opts.locked) return "readonly";
  return opts.canEdit ? "edit" : "readonly";
}

export function formatIjpListHours(totalHours: number | null | undefined): string {
  const n = Number(totalHours);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function formatIjpRateDollars(hourlyRateCents: number): string {
  return (hourlyRateCents / 100).toFixed(2);
}

export function formatIjpInvoiceAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}
