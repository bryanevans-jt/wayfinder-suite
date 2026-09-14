import type { SupabaseClient } from "@supabase/supabase-js";
import { formatPreEtsDistrictFolderName } from "@wayfinder/supabase/pre-ets-invoice-packet";
import type { PreEtsSettingsRow } from "@wayfinder/supabase/pre-ets-settings";
import { driveFileViewUrl, uploadPreEtsFileToDrivePath } from "@/lib/pre-ets-drive";

type SessionRow = {
  session_date: string | null;
  pre_ets_schools:
    | {
        name: string;
        pre_ets_districts:
          | { gvra_district_number: string | null }
          | { gvra_district_number: string | null }[]
          | null;
      }
    | {
        name: string;
        pre_ets_districts:
          | { gvra_district_number: string | null }
          | { gvra_district_number: string | null }[]
          | null;
      }[]
    | null;
  pre_ets_authorizations:
    | { auth_number: string | null; service_month: string }
    | { auth_number: string | null; service_month: string }[]
    | null;
};

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function uploadSessionSignedRosterPdf(
  admin: SupabaseClient,
  sessionId: string,
  settings: PreEtsSettingsRow,
  buffer: Buffer,
  fileName: string
): Promise<{ fileId: string; fileName: string; webViewLink: string | null }> {
  const folderId = settings.drive_signed_roster_folder_id;
  if (!folderId) {
    throw new Error("Signed roster Drive folder is not configured in Pre-ETS settings.");
  }

  const { data: session } = await admin
    .from("pre_ets_sessions")
    .select(
      "session_date, pre_ets_schools(name, pre_ets_districts(gvra_district_number)), pre_ets_authorizations(auth_number, service_month)"
    )
    .eq("id", sessionId)
    .maybeSingle();

  const sessionRow = session as SessionRow | null;
  const school = relationOne(sessionRow?.pre_ets_schools ?? null);
  const district = relationOne(school?.pre_ets_districts ?? null);
  const authorization = relationOne(sessionRow?.pre_ets_authorizations ?? null);
  const serviceMonth = authorization?.service_month
    ? String(authorization.service_month).slice(0, 7)
    : sessionRow?.session_date?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);

  const pathVars = {
    schoolYear: settings.school_year,
    district: formatPreEtsDistrictFolderName(district?.gvra_district_number),
    month: serviceMonth,
    school: school?.name ?? "school",
    authNumber: authorization?.auth_number ?? sessionId.slice(0, 8),
  };

  const uploaded = await uploadPreEtsFileToDrivePath({
    rootFolderId: folderId,
    pathTemplate: settings.drive_folder_path_template,
    pathVars,
    fileName,
    mimeType: "application/pdf",
    buffer,
  });

  const { error } = await admin
    .from("pre_ets_sessions")
    .update({
      signed_roster_drive_file_id: uploaded.fileId,
      signed_roster_drive_file_name: uploaded.fileName,
      signed_roster_uploaded_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw error;

  return {
    fileId: uploaded.fileId,
    fileName: uploaded.fileName,
    webViewLink: uploaded.webViewLink ?? driveFileViewUrl(uploaded.fileId),
  };
}
