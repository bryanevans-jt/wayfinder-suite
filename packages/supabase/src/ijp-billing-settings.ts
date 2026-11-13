import type { SupabaseClient } from "@supabase/supabase-js";
import { isIndividualJobPlacementServiceName } from "@wayfinder/branding";
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

/** Preferred catalog name when creating new IJP enrollments (do not delete the bare row). */
export const GA_IJP_SERVICE_NAME = "Individual Job Placement (GA)";

/** All known catalog / form labels for the same IJP service. */
export const GA_IJP_SERVICE_NAME_VARIANTS = [
  "Individual Job Placement (GA)",
  "Individual Job Placement",
  "IJP",
] as const;

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

/**
 * Every services.id that is Individual Job Placement (bare, "(GA)", etc.).
 * Prefer settings.ga_ijp_service_id first when present — that remains the write-side canonical id.
 */
export async function resolveGaIjpServiceIds(admin: SupabaseClient): Promise<string[]> {
  const settings = await loadIjpBillingSettings(admin);
  const { data } = await admin.from("services").select("id, name, state");
  const matched = (data ?? []).filter((row) =>
    isIndividualJobPlacementServiceName(row.name as string | null)
  );
  const ids = matched.map((row) => row.id as string);
  const preferred = (settings.ga_ijp_service_id ?? "").trim();
  if (preferred && ids.includes(preferred)) {
    return [preferred, ...ids.filter((id) => id !== preferred)];
  }
  if (preferred && !ids.includes(preferred)) {
    return [preferred, ...ids];
  }
  // Prefer the "(GA)" catalog row when settings have not pinned an id yet.
  const gaNamed = matched.find((row) => (row.name as string) === GA_IJP_SERVICE_NAME);
  if (gaNamed?.id) {
    const gaId = gaNamed.id as string;
    return [gaId, ...ids.filter((id) => id !== gaId)];
  }
  return ids;
}

/** Canonical single IJP service id for settings / new writes (first of resolveGaIjpServiceIds). */
export async function resolveGaIjpServiceId(admin: SupabaseClient): Promise<string | null> {
  const ids = await resolveGaIjpServiceIds(admin);
  return ids[0] ?? null;
}

/**
 * Add / edit IJP Billing invoice rows (create, patch line hours / billing fields).
 * Accounts Specialist (`accountant`), Admin, and Super Admin.
 * Does not include delete, settings, or sandbox test tools.
 */
export function canEditIjpBilling(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (isSuperAdminRole(r)) return true;
  if (isAdminRole(r)) return true;
  if (isAccountantRole(r)) return true;
  return false;
}

/**
 * Generate Month / weekly invoice generation (including cron-triggered UI).
 * Accounts Specialist, Admin, and Super Admin — same as edit.
 */
export function canGenerateIjpBilling(role: string | null | undefined): boolean {
  return canEditIjpBilling(role);
}

/** Sandbox / test invoice tools — Admin and Super Admin only (not Accounts Specialist). */
export function canUseIjpBillingTestTools(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return isSuperAdminRole(r) || isAdminRole(r);
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
