import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyPreEtsAuthorizationType,
  loadPreEtsSettings,
} from "./pre-ets-settings";

export type UpdatePreEtsAuthorizationAuthNumberResult =
  | { ok: true; authType: "group" | "individual" }
  | { ok: false; error: string };

export function validatePreEtsAuthorizationNumberForRoster(
  authNumber: string,
  rosterStudentCount: number,
  groupAuthDigitCount: number
): UpdatePreEtsAuthorizationAuthNumberResult {
  const trimmed = authNumber.trim();
  if (!trimmed) {
    return { ok: false, error: "Authorization number is required." };
  }

  const authType = classifyPreEtsAuthorizationType(trimmed, groupAuthDigitCount);
  if (authType === "unknown") {
    return {
      ok: false,
      error: "Authorization number format is not recognized as group or individual.",
    };
  }

  if (authType === "individual" && rosterStudentCount > 1) {
    return {
      ok: false,
      error: "Individual authorizations may only have one student on the roster.",
    };
  }

  return { ok: true, authType };
}

/** Admin / Super Admin — change GVRA authorization number (A&I) on an existing roster. */
export async function updatePreEtsAuthorizationAuthNumber(
  admin: SupabaseClient,
  input: { authorizationId: string; authNumber: string }
): Promise<UpdatePreEtsAuthorizationAuthNumberResult> {
  const settings = await loadPreEtsSettings(admin);

  const { data: authRow, error: authErr } = await admin
    .from("pre_ets_authorizations")
    .select("id, auth_number")
    .eq("id", input.authorizationId)
    .maybeSingle();

  if (authErr || !authRow) {
    return { ok: false, error: authErr?.message ?? "Authorization not found." };
  }

  const trimmed = input.authNumber.trim();
  const current = ((authRow.auth_number as string | null) ?? "").trim();
  if (trimmed === current) {
    const authType = classifyPreEtsAuthorizationType(trimmed, settings.group_auth_digit_count);
    if (authType === "unknown") {
      return { ok: false, error: "Authorization number format is not recognized as group or individual." };
    }
    return { ok: true, authType };
  }

  const { count, error: countErr } = await admin
    .from("pre_ets_roster_entries")
    .select("id", { count: "exact", head: true })
    .eq("authorization_id", input.authorizationId)
    .eq("not_approved", false);

  if (countErr) {
    return { ok: false, error: countErr.message };
  }

  const rosterStudentCount = count ?? 0;
  const validated = validatePreEtsAuthorizationNumberForRoster(
    trimmed,
    rosterStudentCount,
    settings.group_auth_digit_count
  );
  if (!validated.ok) {
    return validated;
  }

  const { error: updErr } = await admin
    .from("pre_ets_authorizations")
    .update({
      auth_number: trimmed,
      auth_type: validated.authType,
    })
    .eq("id", input.authorizationId);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  return { ok: true, authType: validated.authType };
}
