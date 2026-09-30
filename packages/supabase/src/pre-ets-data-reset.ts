import type { SupabaseClient } from "@supabase/supabase-js";
import { isPreEtsClassSetupSchemaAvailable } from "./pre-ets-class-setup";

export type ResetPreEtsBillingMonthInput = {
  districtNumber: string;
  schoolYear: string;
  serviceMonth: string;
  clearWorksheetImports?: boolean;
  clearGroupMappings?: boolean;
  clearClassSetup?: boolean;
};

export type ResetPreEtsBillingMonthResult =
  | {
      ok: true;
      programGroupsRemoved: number;
      authorizationsRemoved: number;
      worksheetImportsRemoved: number;
      groupMappingsRemoved: number;
      classSetupRowsRemoved: number;
    }
  | { ok: false; error: string };

function normalizeServiceMonth(month: string): string {
  const trimmed = month.trim();
  return trimmed.length === 7 ? `${trimmed}-01` : trimmed.slice(0, 10);
}

/** Super-admin cleanup: drop billing month data for one district so worksheets can be re-imported cleanly. */
export async function resetPreEtsBillingMonthForDistrict(
  admin: SupabaseClient,
  input: ResetPreEtsBillingMonthInput
): Promise<ResetPreEtsBillingMonthResult> {
  const districtNumber = input.districtNumber.trim();
  const schoolYear = input.schoolYear.trim();
  const serviceMonth = normalizeServiceMonth(input.serviceMonth);

  if (!districtNumber || !schoolYear || !serviceMonth) {
    return { ok: false, error: "District number, school year, and service month are required" };
  }

  const { data: district, error: distErr } = await admin
    .from("pre_ets_districts")
    .select("id")
    .eq("gvra_district_number", districtNumber)
    .eq("school_year", schoolYear)
    .maybeSingle();

  if (distErr) {
    return { ok: false, error: distErr.message };
  }
  if (!district?.id) {
    return { ok: false, error: `District ${districtNumber} was not found for ${schoolYear}` };
  }

  const districtId = district.id as string;

  const { data: schools, error: schoolErr } = await admin
    .from("pre_ets_schools")
    .select("id")
    .eq("district_id", districtId);

  if (schoolErr) {
    return { ok: false, error: schoolErr.message };
  }

  const schoolIds = (schools ?? []).map((s) => s.id as string);
  let programGroupsRemoved = 0;
  let authorizationsRemoved = 0;

  if (schoolIds.length > 0) {
    const { data: groups, error: groupErr } = await admin
      .from("pre_ets_program_groups")
      .select("id")
      .in("school_id", schoolIds)
      .eq("service_month", serviceMonth);

    if (groupErr) {
      return { ok: false, error: groupErr.message };
    }

    const groupIds = (groups ?? []).map((g) => g.id as string);
    programGroupsRemoved = groupIds.length;

    if (groupIds.length > 0) {
      const { count: authCount, error: authDelErr } = await admin
        .from("pre_ets_authorizations")
        .delete({ count: "exact" })
        .in("program_group_id", groupIds);

      if (authDelErr) {
        return { ok: false, error: authDelErr.message };
      }
      authorizationsRemoved = authCount ?? 0;

      const { error: pgDelErr } = await admin
        .from("pre_ets_program_groups")
        .delete()
        .in("id", groupIds);

      if (pgDelErr) {
        return { ok: false, error: pgDelErr.message };
      }
    }

    const { error: orphanAuthErr } = await admin
      .from("pre_ets_authorizations")
      .delete()
      .in("school_id", schoolIds)
      .eq("service_month", serviceMonth);

    if (orphanAuthErr) {
      return { ok: false, error: orphanAuthErr.message };
    }
  }

  let worksheetImportsRemoved = 0;
  if (input.clearWorksheetImports !== false) {
    const { count, error: impErr } = await admin
      .from("pre_ets_worksheet_imports")
      .delete({ count: "exact" })
      .eq("district_id", districtId)
      .eq("service_month", serviceMonth);

    if (impErr) {
      return { ok: false, error: impErr.message };
    }
    worksheetImportsRemoved = count ?? 0;
  }

  let groupMappingsRemoved = 0;
  if (input.clearGroupMappings) {
    const { count, error: mapErr } = await admin
      .from("pre_ets_worksheet_group_mappings")
      .delete({ count: "exact" })
      .eq("district_id", districtId)
      .eq("school_year", schoolYear);

    if (mapErr) {
      return { ok: false, error: mapErr.message };
    }
    groupMappingsRemoved = count ?? 0;
  }

  let classSetupRowsRemoved = 0;
  if (input.clearClassSetup && (await isPreEtsClassSetupSchemaAvailable(admin))) {
    const { count, error: setupErr } = await admin
      .from("pre_ets_class_setup")
      .delete({ count: "exact" })
      .eq("school_year", schoolYear)
      .eq("district_number", districtNumber);

    if (setupErr) {
      return { ok: false, error: setupErr.message };
    }
    classSetupRowsRemoved = count ?? 0;
  }

  return {
    ok: true,
    programGroupsRemoved,
    authorizationsRemoved,
    worksheetImportsRemoved,
    groupMappingsRemoved,
    classSetupRowsRemoved,
  };
}
