import { resolvePreEtsDrivePath } from "@wayfinder/supabase/pre-ets-invoice-packet";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { uploadPreEtsFileToDrive } from "@/lib/pre-ets-drive";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function archiveWorksheetImportToDrive(
  admin: SupabaseClient,
  importId: string
): Promise<{ ok: true; driveFileId: string } | { ok: false; error: string }> {
  const settings = await loadPreEtsSettings(admin);
  const folderId = settings.drive_worksheet_archive_folder_id;
  if (!folderId) {
    return { ok: false, error: "Worksheet archive folder is not configured." };
  }

  const { data: imp } = await admin
    .from("pre_ets_worksheet_imports")
    .select("id, file_name, file_content, service_month, school_year, parse_result")
    .eq("id", importId)
    .maybeSingle();

  if (!imp?.file_content) {
    return { ok: false, error: "Original worksheet file content is not available." };
  }

  const parsed = imp.parse_result as { districtNumber?: string } | null;
  const fileName =
    imp.file_name ||
    `pre-ets-worksheet-${parsed?.districtNumber ?? importId.slice(0, 8)}.csv`;

  const subpath = resolvePreEtsDrivePath(settings.drive_folder_path_template, {
    schoolYear: imp.school_year as string,
    month: String(imp.service_month).slice(0, 7),
    school: parsed?.districtNumber ?? "district",
    authNumber: "worksheets",
  });

  const uploaded = await uploadPreEtsFileToDrive({
    folderId,
    fileName: `${subpath.replace(/\//g, "_")}_${fileName}`,
    mimeType: "text/csv",
    buffer: Buffer.from(imp.file_content as string, "utf-8"),
  });

  await admin
    .from("pre_ets_worksheet_imports")
    .update({
      drive_file_id: uploaded.fileId,
      drive_file_name: uploaded.fileName,
      archived_at: new Date().toISOString(),
    })
    .eq("id", importId);

  return { ok: true, driveFileId: uploaded.fileId };
}
