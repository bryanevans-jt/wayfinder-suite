import type { SupabaseClient } from "@supabase/supabase-js";

export type TnReportDefinition = {
  slug: string;
  name: string;
  enabled: boolean;
  requiresSignature: boolean;
  templateKind: string;
  googleDocTemplateId: string | null;
  blankPdfFileId: string | null;
  driveFolderId: string | null;
};

export async function loadTnReportDefinition(
  admin: SupabaseClient,
  reportTypeSlug: string
): Promise<TnReportDefinition | null> {
  const { data, error } = await admin
    .from("report_type_definitions")
    .select(
      "slug, name, enabled, requires_signature, template_kind, google_doc_template_id, blank_pdf_file_id, drive_folder_id"
    )
    .eq("state", "TN")
    .eq("slug", reportTypeSlug.trim())
    .maybeSingle();

  if (error || !data) return null;

  return {
    slug: data.slug as string,
    name: data.name as string,
    enabled: Boolean(data.enabled),
    requiresSignature: Boolean(data.requires_signature),
    templateKind: (data.template_kind as string) ?? "google_doc",
    googleDocTemplateId: (data.google_doc_template_id as string | null) ?? null,
    blankPdfFileId: (data.blank_pdf_file_id as string | null) ?? null,
    driveFolderId: (data.drive_folder_id as string | null) ?? null,
  };
}
