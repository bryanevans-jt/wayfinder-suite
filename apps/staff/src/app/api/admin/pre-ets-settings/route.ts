import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  DEFAULT_PRE_ETS_SETTINGS,
  loadPreEtsSettings,
  normalizePreEtsSettingsRow,
  parsePreEtsRateDollars,
  PRE_ETS_ROLLOUT_ROLES,
  type PreEtsInvoiceExportMode,
  type PreEtsServiceCodeRow,
  type PreEtsSettingsRow,
} from "@wayfinder/supabase/pre-ets-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { canManagePreEtsSettings, normalizeRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

function sanitizeEnabledRoles(roles: unknown): string[] {
  if (!Array.isArray(roles)) return ["super_admin"];
  const normalized = roles
    .map((r) => normalizeRole(String(r)))
    .filter((r) => PRE_ETS_ROLLOUT_ROLES.includes(r as (typeof PRE_ETS_ROLLOUT_ROLES)[number]));
  const unique = [...new Set(normalized)];
  if (!unique.includes("super_admin")) {
    unique.unshift("super_admin");
  }
  return unique;
}

function sanitizeServiceCodes(raw: unknown): PreEtsServiceCodeRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const code = String(r.code ?? "").trim();
      if (!code) return null;
      return {
        code,
        service: String(r.service ?? "").trim(),
        description: String(r.description ?? "").trim(),
      };
    })
    .filter((row): row is PreEtsServiceCodeRow => row !== null);
}

function buildPatch(
  body: Partial<PreEtsSettingsRow> & { default_rate_dollars?: string },
  userId: string
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (typeof body.module_enabled === "boolean") patch.module_enabled = body.module_enabled;
  if (body.enabled_roles !== undefined) patch.enabled_roles = sanitizeEnabledRoles(body.enabled_roles);
  if (body.school_year !== undefined) patch.school_year = String(body.school_year).trim();
  if (body.drive_signed_roster_folder_id !== undefined) {
    patch.drive_signed_roster_folder_id = body.drive_signed_roster_folder_id || null;
  }
  if (body.drive_invoice_archive_folder_id !== undefined) {
    patch.drive_invoice_archive_folder_id = body.drive_invoice_archive_folder_id || null;
  }
  if (body.drive_worksheet_archive_folder_id !== undefined) {
    patch.drive_worksheet_archive_folder_id = body.drive_worksheet_archive_folder_id || null;
  }
  if (body.drive_folder_path_template !== undefined) {
    patch.drive_folder_path_template = String(body.drive_folder_path_template).trim();
  }
  if (body.template_roster_doc_id !== undefined) {
    patch.template_roster_doc_id = body.template_roster_doc_id || null;
  }
  if (body.template_car_doc_id !== undefined) {
    patch.template_car_doc_id = body.template_car_doc_id || null;
  }
  if (body.template_invoice_cover_doc_id !== undefined) {
    patch.template_invoice_cover_doc_id = body.template_invoice_cover_doc_id || null;
  }
  if (body.template_invoice_attestation_doc_id !== undefined) {
    patch.template_invoice_attestation_doc_id = body.template_invoice_attestation_doc_id || null;
  }
  if (body.template_individual_roster_doc_id !== undefined) {
    patch.template_individual_roster_doc_id = body.template_individual_roster_doc_id || null;
  }
  if (body.default_rate_cents !== undefined) {
    patch.default_rate_cents = body.default_rate_cents;
  }
  if (body.default_rate_dollars !== undefined) {
    patch.default_rate_cents = parsePreEtsRateDollars(body.default_rate_dollars);
  }
  if (body.provider_name !== undefined) patch.provider_name = String(body.provider_name).trim();
  if (body.remit_address !== undefined) patch.remit_address = String(body.remit_address).trim();
  if (body.ytd_unit_warning_threshold !== undefined) {
    patch.ytd_unit_warning_threshold = Number(body.ytd_unit_warning_threshold);
  }
  if (body.invoice_export_mode !== undefined) {
    const mode = String(body.invoice_export_mode) as PreEtsInvoiceExportMode;
    patch.invoice_export_mode =
      mode === "combined_pdf" || mode === "sections_only" ? mode : "both";
  }
  if (body.submission_deadline_hours !== undefined) {
    patch.submission_deadline_hours = Number(body.submission_deadline_hours);
  }
  if (body.group_auth_digit_count !== undefined) {
    patch.group_auth_digit_count = Number(body.group_auth_digit_count);
  }
  if (body.not_approved_marker !== undefined) {
    patch.not_approved_marker = String(body.not_approved_marker).trim();
  }
  if (body.service_codes !== undefined) {
    patch.service_codes = sanitizeServiceCodes(body.service_codes);
  }

  return patch;
}

export async function GET() {
  const route = "api/admin/pre-ets-settings";
  const session = await getAppSession();
  if (!session || !canManagePreEtsSettings(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const admin = createServiceRoleClient();
    const settings = await loadPreEtsSettings(admin);
    return NextResponse.json({
      settings,
      rolloutRoles: PRE_ETS_ROLLOUT_ROLES,
      defaults: DEFAULT_PRE_ETS_SETTINGS,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}

export async function PATCH(request: Request) {
  const route = "api/admin/pre-ets-settings";
  const session = await getAppSession();
  if (!session || !canManagePreEtsSettings(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const body = (await request.json()) as Partial<PreEtsSettingsRow> & {
      default_rate_dollars?: string;
    };
    const admin = createServiceRoleClient();
    const { data: row } = await admin.from("pre_ets_settings").select("id").limit(1).maybeSingle();
    const patch = buildPatch(body, session.effectiveUserId);

    const { data, error } = row?.id
      ? await admin.from("pre_ets_settings").update(patch).eq("id", row.id).select("*").single()
      : await admin
          .from("pre_ets_settings")
          .insert({ ...DEFAULT_PRE_ETS_SETTINGS, ...patch })
          .select("*")
          .single();

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    return NextResponse.json({
      ok: true,
      settings: normalizePreEtsSettingsRow(data as Record<string, unknown>),
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
