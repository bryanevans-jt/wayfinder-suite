import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAccountantRole,
  isAdminRole,
  isEsRole,
  isHrRole,
  isInstructorRole,
  isSuperAdminRole,
  isSupervisorRole,
  isTransitionSpecialistRole,
  normalizeRole,
} from "./roles";

export const PRE_ETS_ROLLOUT_ROLES = [
  "super_admin",
  "admin",
  "accountant",
  "supervisor",
  "es",
  "transition_specialist",
  "instructor",
  "hr",
] as const;

export type PreEtsRolloutRole = (typeof PRE_ETS_ROLLOUT_ROLES)[number];

export type PreEtsInvoiceExportMode = "combined_pdf" | "sections_only" | "both";

export type PreEtsServiceCodeRow = {
  code: string;
  service: string;
  description: string;
};

export type PreEtsSettingsRow = {
  id: string;
  module_enabled: boolean;
  enabled_roles: string[];
  school_year: string;
  drive_signed_roster_folder_id: string | null;
  drive_invoice_archive_folder_id: string | null;
  drive_worksheet_archive_folder_id: string | null;
  drive_folder_path_template: string;
  template_roster_doc_id: string | null;
  template_car_doc_id: string | null;
  template_invoice_cover_doc_id: string | null;
  template_invoice_attestation_doc_id: string | null;
  template_individual_roster_doc_id: string | null;
  default_rate_cents: number;
  provider_name: string;
  remit_address: string;
  ytd_unit_warning_threshold: number;
  invoice_export_mode: PreEtsInvoiceExportMode;
  submission_deadline_hours: number;
  group_auth_digit_count: number;
  not_approved_marker: string;
  service_codes: PreEtsServiceCodeRow[];
  updated_at: string;
  updated_by: string | null;
};

export const DEFAULT_PRE_ETS_SETTINGS: Omit<
  PreEtsSettingsRow,
  "id" | "updated_at" | "updated_by"
> = {
  module_enabled: true,
  enabled_roles: ["super_admin"],
  school_year: "2025-2026",
  drive_signed_roster_folder_id: null,
  drive_invoice_archive_folder_id: null,
  drive_worksheet_archive_folder_id: null,
  drive_folder_path_template: "{SchoolYear}/{District}/{School}/{Month}",
  template_roster_doc_id: null,
  template_car_doc_id: null,
  template_invoice_cover_doc_id: null,
  template_invoice_attestation_doc_id: null,
  template_individual_roster_doc_id: null,
  default_rate_cents: 9000,
  provider_name: "Joshua Tree Service Group",
  remit_address: "505 S. Tennille Ave. Donalsonville, GA 39845",
  ytd_unit_warning_threshold: 15,
  invoice_export_mode: "both",
  submission_deadline_hours: 24,
  group_auth_digit_count: 5,
  not_approved_marker: "NOT APPROVED",
  service_codes: [],
};

/** Replace NBSP and trim; safe for any GVRA characters in the value. */
export function sanitizePreEtsServiceTextField(value: string): string {
  return value.replace(/\u00a0/g, " ").trim();
}

/**
 * Clean a service code for storage/display. Preserves hyphens and special characters;
 * collapses odd whitespace so "PRE - 3241" is stored consistently.
 */
export function sanitizePreEtsServiceCodeText(code: string): string {
  return sanitizePreEtsServiceTextField(code).replace(/\s+/g, " ");
}

/**
 * Comparison key for service codes — spacing around hyphens and case do not matter.
 * "PRE - 3241", "PRE-3241", and "pre-3241" all match.
 */
export function normalizePreEtsServiceCodeKey(code: string): string {
  return sanitizePreEtsServiceCodeText(code)
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, "")
    .toUpperCase();
}

export function preEtsServiceCodesMatch(
  a: string | null | undefined,
  b: string | null | undefined
): boolean {
  const left = (a ?? "").trim();
  const right = (b ?? "").trim();
  if (!left || !right) return false;
  return normalizePreEtsServiceCodeKey(left) === normalizePreEtsServiceCodeKey(right);
}

export function sanitizePreEtsServiceCodes(raw: unknown): PreEtsServiceCodeRow[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const rows: PreEtsServiceCodeRow[] = [];

  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const code = sanitizePreEtsServiceCodeText(String(r.code ?? ""));
    if (!code) continue;
    const key = normalizePreEtsServiceCodeKey(code);
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({
      code,
      service: sanitizePreEtsServiceTextField(String(r.service ?? "")),
      description: sanitizePreEtsServiceTextField(String(r.description ?? "")),
    });
  }

  return rows;
}

function parseServiceCodes(raw: unknown): PreEtsServiceCodeRow[] {
  return sanitizePreEtsServiceCodes(raw);
}

export function normalizePreEtsSettingsRow(
  data: Record<string, unknown> | null
): PreEtsSettingsRow {
  if (!data) {
    return {
      id: "",
      updated_at: new Date().toISOString(),
      updated_by: null,
      ...DEFAULT_PRE_ETS_SETTINGS,
    };
  }

  const enabledRoles = Array.isArray(data.enabled_roles)
    ? (data.enabled_roles as string[]).map((r) => normalizeRole(r)).filter(Boolean)
    : DEFAULT_PRE_ETS_SETTINGS.enabled_roles;

  const exportMode = String(data.invoice_export_mode ?? "both");
  const invoiceExportMode: PreEtsInvoiceExportMode =
    exportMode === "combined_pdf" || exportMode === "sections_only" ? exportMode : "both";

  return {
    id: String(data.id ?? ""),
    module_enabled: data.module_enabled !== false,
    enabled_roles: enabledRoles.length > 0 ? enabledRoles : ["super_admin"],
    school_year: String(data.school_year ?? DEFAULT_PRE_ETS_SETTINGS.school_year),
    drive_signed_roster_folder_id:
      (data.drive_signed_roster_folder_id as string | null) ?? null,
    drive_invoice_archive_folder_id:
      (data.drive_invoice_archive_folder_id as string | null) ?? null,
    drive_worksheet_archive_folder_id:
      (data.drive_worksheet_archive_folder_id as string | null) ?? null,
    drive_folder_path_template: String(
      data.drive_folder_path_template ?? DEFAULT_PRE_ETS_SETTINGS.drive_folder_path_template
    ),
    template_roster_doc_id: (data.template_roster_doc_id as string | null) ?? null,
    template_car_doc_id: (data.template_car_doc_id as string | null) ?? null,
    template_invoice_cover_doc_id:
      (data.template_invoice_cover_doc_id as string | null) ?? null,
    template_invoice_attestation_doc_id:
      (data.template_invoice_attestation_doc_id as string | null) ?? null,
    template_individual_roster_doc_id:
      (data.template_individual_roster_doc_id as string | null) ?? null,
    default_rate_cents: Number(data.default_rate_cents ?? DEFAULT_PRE_ETS_SETTINGS.default_rate_cents),
    provider_name: String(data.provider_name ?? DEFAULT_PRE_ETS_SETTINGS.provider_name),
    remit_address: String(data.remit_address ?? DEFAULT_PRE_ETS_SETTINGS.remit_address),
    ytd_unit_warning_threshold: Number(
      data.ytd_unit_warning_threshold ?? DEFAULT_PRE_ETS_SETTINGS.ytd_unit_warning_threshold
    ),
    invoice_export_mode: invoiceExportMode,
    submission_deadline_hours: Number(
      data.submission_deadline_hours ?? DEFAULT_PRE_ETS_SETTINGS.submission_deadline_hours
    ),
    group_auth_digit_count: Number(
      data.group_auth_digit_count ?? DEFAULT_PRE_ETS_SETTINGS.group_auth_digit_count
    ),
    not_approved_marker: String(
      data.not_approved_marker ?? DEFAULT_PRE_ETS_SETTINGS.not_approved_marker
    ),
    service_codes: parseServiceCodes(data.service_codes),
    updated_at: String(data.updated_at ?? new Date().toISOString()),
    updated_by: (data.updated_by as string | null) ?? null,
  };
}

export async function loadPreEtsSettings(
  admin: SupabaseClient
): Promise<PreEtsSettingsRow> {
  const { data, error } = await admin.from("pre_ets_settings").select("*").limit(1).maybeSingle();
  if (error) {
    console.error("pre_ets_settings load failed:", error.message);
    return normalizePreEtsSettingsRow(null);
  }
  return normalizePreEtsSettingsRow((data as Record<string, unknown> | null) ?? null);
}

export function isPreEtsRolloutRole(role: string): role is PreEtsRolloutRole {
  return (PRE_ETS_ROLLOUT_ROLES as readonly string[]).includes(normalizeRole(role));
}

/** Module visibility — reads enabled_roles from settings (defaults to super_admin only). */
export function canAccessPreEts(
  role: string | null | undefined,
  settings?: Pick<PreEtsSettingsRow, "module_enabled" | "enabled_roles"> | null
): boolean {
  const r = normalizeRole(role);
  if (!r) return false;
  if (isSuperAdminRole(r)) return true;
  if (settings && !settings.module_enabled) return false;
  const enabled = settings?.enabled_roles ?? DEFAULT_PRE_ETS_SETTINGS.enabled_roles;
  return enabled.map(normalizeRole).includes(r);
}

/** Accounts Specialist billing/import functions — also granted to admin and super_admin. */
export function canAccessPreEtsAccounts(
  role: string | null | undefined,
  settings?: Pick<PreEtsSettingsRow, "module_enabled" | "enabled_roles"> | null
): boolean {
  const r = normalizeRole(role);
  if (isSuperAdminRole(r)) return true;
  if (isAdminRole(r)) return canAccessPreEts(r, settings);
  if (isAccountantRole(r)) return canAccessPreEts(r, settings);
  return false;
}

/** Super Admin only — settings page and role rollout configuration. */
export function canManagePreEtsSettings(role: string | null | undefined): boolean {
  return isSuperAdminRole(role);
}

/** HR view-only oversight when hr is in enabled_roles. */
export function canViewPreEtsHr(
  role: string | null | undefined,
  settings?: Pick<PreEtsSettingsRow, "module_enabled" | "enabled_roles"> | null
): boolean {
  if (!isHrRole(role)) return false;
  return canAccessPreEts(role, settings);
}

/** Field delivery: Transition Specialist (or legacy instructor) / ES when enabled. */
export function canDeliverPreEtsSessions(
  role: string | null | undefined,
  settings?: Pick<PreEtsSettingsRow, "module_enabled" | "enabled_roles"> | null
): boolean {
  const r = normalizeRole(role);
  if (isTransitionSpecialistRole(r) || isInstructorRole(r) || isEsRole(r)) {
    return canAccessPreEts(r, settings);
  }
  if (isSuperAdminRole(r)) {
    return true;
  }
  return false;
}

/** Supervisor regional oversight when supervisor is enabled. */
export function canSupervisePreEts(
  role: string | null | undefined,
  settings?: Pick<PreEtsSettingsRow, "module_enabled" | "enabled_roles"> | null
): boolean {
  const r = normalizeRole(role);
  if (isSupervisorRole(r)) {
    return canAccessPreEts(r, settings);
  }
  if (isSuperAdminRole(r)) {
    return true;
  }
  return false;
}

/** Classify GVRA authorization number as group vs individual. */
export function classifyPreEtsAuthorizationType(
  authNumber: string,
  groupDigitCount = DEFAULT_PRE_ETS_SETTINGS.group_auth_digit_count
): "group" | "individual" | "unknown" {
  const digits = authNumber.replace(/\D/g, "");
  if (!digits) return "unknown";
  if (digits.length === groupDigitCount) return "group";
  if (digits.length > groupDigitCount) return "individual";
  return "unknown";
}

export function formatPreEtsRateDollars(rateCents: number): string {
  return (rateCents / 100).toFixed(2);
}

export function parsePreEtsRateDollars(value: string): number {
  const n = Number.parseFloat(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PRE_ETS_SETTINGS.default_rate_cents;
  return Math.round(n * 100);
}

/** Look up a configured GVRA service code row (spacing/hyphen tolerant). */
export function lookupPreEtsServiceCode(
  code: string,
  settings: Pick<PreEtsSettingsRow, "service_codes">
): PreEtsServiceCodeRow | null {
  const key = normalizePreEtsServiceCodeKey(code);
  if (!key) return null;
  return (
    settings.service_codes.find(
      (row) => normalizePreEtsServiceCodeKey(row.code) === key
    ) ?? null
  );
}

/** Prefer settings catalog description, then worksheet label, then short service name. */
export function resolvePreEtsServiceLabel(
  code: string,
  fallbackLabel: string | null | undefined,
  settings: Pick<PreEtsSettingsRow, "service_codes">
): string {
  const row = lookupPreEtsServiceCode(code, settings);
  if (row?.description) return row.description;
  if (fallbackLabel?.trim()) return sanitizePreEtsServiceTextField(fallbackLabel);
  if (row?.service) return row.service;
  return sanitizePreEtsServiceCodeText(code);
}

/** Short service name from catalog when configured. */
export function resolvePreEtsServiceName(
  code: string,
  settings: Pick<PreEtsSettingsRow, "service_codes">
): string {
  const row = lookupPreEtsServiceCode(code, settings);
  return row?.service?.trim() || sanitizePreEtsServiceCodeText(code);
}

/** Whether a code appears in the configured catalog (empty catalog = allow any). */
export function isKnownPreEtsServiceCode(
  code: string,
  settings: Pick<PreEtsSettingsRow, "service_codes">
): boolean {
  if (settings.service_codes.length === 0) return true;
  return lookupPreEtsServiceCode(code, settings) !== null;
}

/** Soft YTD warning — no hard cap. */
export function isPreEtsYtdAtOrAboveWarning(
  billableUnits: number,
  threshold = DEFAULT_PRE_ETS_SETTINGS.ytd_unit_warning_threshold
): boolean {
  return billableUnits >= threshold;
}
