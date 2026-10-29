import type { SupabaseClient } from "@supabase/supabase-js";
import { isSuperAdminRole } from "./roles";

export type KraBillableRule = {
  service_ids: string[];
  hours_per_client_per_month: number;
};

export type KraBillableSettingsRow = {
  id: string;
  count_system_allowance_toward_kra: boolean;
  successor_inherits_client_month_hours: boolean;
  rules: KraBillableRule[];
  updated_at: string;
  updated_by: string | null;
};

export const DEFAULT_KRA_HOURS_PER_CLIENT = 10;

export const KRA_GVRA_SERVICE_NAMES = [
  "Individual Job Placement (GA)",
  "Traditional Supported Employment (GA)",
] as const;

export async function loadKraBillableSettings(
  admin: SupabaseClient
): Promise<KraBillableSettingsRow> {
  const { data, error } = await admin
    .from("org_kra_billable_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error("org_kra_billable_settings row missing");
  }
  const rulesRaw = data.rules;
  const rules: KraBillableRule[] = Array.isArray(rulesRaw)
    ? (rulesRaw as KraBillableRule[]).map((r) => ({
        service_ids: Array.isArray(r.service_ids) ? r.service_ids.map(String) : [],
        hours_per_client_per_month: Number(r.hours_per_client_per_month) || DEFAULT_KRA_HOURS_PER_CLIENT,
      }))
    : [];
  return {
    id: data.id as string,
    count_system_allowance_toward_kra: data.count_system_allowance_toward_kra !== false,
    successor_inherits_client_month_hours: data.successor_inherits_client_month_hours !== false,
    rules,
    updated_at: data.updated_at as string,
    updated_by: (data.updated_by as string | null) ?? null,
  };
}

export function thresholdHoursForService(
  settings: KraBillableSettingsRow,
  serviceId: string | null | undefined
): number | null {
  if (!serviceId) return null;
  for (const rule of settings.rules) {
    if (rule.service_ids.includes(serviceId)) {
      return rule.hours_per_client_per_month;
    }
  }
  return null;
}

export function serviceIdsInKraScope(settings: KraBillableSettingsRow): Set<string> {
  const ids = new Set<string>();
  for (const rule of settings.rules) {
    for (const id of rule.service_ids) {
      if (id) ids.add(id);
    }
  }
  return ids;
}

export function canManageKraBillableSettings(role: string | null | undefined): boolean {
  return isSuperAdminRole(role);
}
