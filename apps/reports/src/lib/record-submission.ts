import type { SupabaseClient } from "@supabase/supabase-js";

export type RecordSubmissionInput = {
  wayfinderClientId?: string | null;
  clientName: string;
  state: "GA" | "TN";
  reportTypeSlug: string;
  reportingMonth?: string | null;
  submittedBy: string;
  submittedByName?: string | null;
  driveFileId?: string | null;
  driveFileName?: string | null;
  fieldSnapshot?: Record<string, unknown>;
};

export async function recordFormalSubmission(
  admin: SupabaseClient,
  input: RecordSubmissionInput
): Promise<void> {
  const { error } = await admin.from("formal_report_submissions").insert({
    wayfinder_client_id: input.wayfinderClientId ?? null,
    client_name: input.clientName.trim(),
    state: input.state,
    report_type_slug: input.reportTypeSlug,
    reporting_month: input.reportingMonth ?? null,
    submitted_by: input.submittedBy,
    submitted_by_name: input.submittedByName ?? null,
    drive_file_id: input.driveFileId ?? null,
    drive_file_name: input.driveFileName ?? null,
    field_snapshot: input.fieldSnapshot ?? {},
  });

  if (error) {
    console.error("formal_report_submissions insert failed:", error.message);
  }
}

export function driveFileUrl(fileId: string | null | undefined): string | null {
  if (!fileId?.trim()) return null;
  return `https://drive.google.com/file/d/${fileId.trim()}/view`;
}
