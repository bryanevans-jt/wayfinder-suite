/**
 * One-time October attestation Drive copy + link plan.
 * Dry-run by default — never copies Drive or writes unless execute=true
 * (execute is reserved for a future operator run; this PR does not call it).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type OctoberAttestationBackfillCandidate = {
  sourceAttestationId: string;
  clientId: string;
  sourceServiceMonth: string;
  capturedAt: string | null;
  sourceDriveFileId: string;
  sourceDriveFileName: string | null;
  octoberAlreadyLinked: boolean;
  octoberExistingDriveFileId: string | null;
};

export type OctoberAttestationBackfillPlan = {
  dryRun: boolean;
  attestationRootFolderId: string | null;
  targetRelativePath: string;
  candidates: OctoberAttestationBackfillCandidate[];
  counts: {
    sourceWithDrive: number;
    wouldCopy: number;
    alreadyLinkedOctober: number;
    skippedMissingDrive: number;
  };
};

const CAPTURE_START = "2026-10-01T00:00:00.000Z";
const CAPTURE_END = "2026-12-01T00:00:00.000Z";
const OCTOBER_MONTH = "2026-10-01";

/**
 * Read-only plan: prod attestations whose signature was captured in calendar
 * Oct or Nov 2026, that have a Drive PDF, for linking/copying into October.
 */
export async function planOctoberAttestationBackfill(
  admin: SupabaseClient,
  opts?: { dryRun?: boolean }
): Promise<OctoberAttestationBackfillPlan> {
  const dryRun = opts?.dryRun !== false;

  const { data: settings } = await admin
    .from("ijp_billing_settings")
    .select("drive_attestation_folder_id")
    .limit(1)
    .maybeSingle();

  const { data: sources, error } = await admin
    .from("ijp_monthly_attestations")
    .select(
      "id, client_id, service_month, captured_at, attestation_drive_file_id, attestation_drive_file_name, is_test"
    )
    .eq("is_test", false)
    .not("attestation_drive_file_id", "is", null)
    .gte("captured_at", CAPTURE_START)
    .lt("captured_at", CAPTURE_END)
    .order("captured_at", { ascending: true });
  if (error) throw new Error(error.message);

  const clientIds = [
    ...new Set((sources ?? []).map((s) => s.client_id as string).filter(Boolean)),
  ];
  const octoberByClient = new Map<
    string,
    { attestation_drive_file_id: string | null }
  >();
  if (clientIds.length > 0) {
    const { data: octRows } = await admin
      .from("ijp_monthly_attestations")
      .select("client_id, attestation_drive_file_id")
      .eq("service_month", OCTOBER_MONTH)
      .eq("is_test", false)
      .in("client_id", clientIds);
    for (const row of octRows ?? []) {
      octoberByClient.set(row.client_id as string, {
        attestation_drive_file_id: row.attestation_drive_file_id as string | null,
      });
    }
  }

  const candidates: OctoberAttestationBackfillCandidate[] = [];
  let skippedMissingDrive = 0;
  for (const src of sources ?? []) {
    const driveId = (src.attestation_drive_file_id as string | null)?.trim() || "";
    if (!driveId) {
      skippedMissingDrive += 1;
      continue;
    }
    const oct = octoberByClient.get(src.client_id as string);
    const already = Boolean(oct?.attestation_drive_file_id);
    candidates.push({
      sourceAttestationId: src.id as string,
      clientId: src.client_id as string,
      sourceServiceMonth: (src.service_month as string)?.slice?.(0, 10) ?? String(src.service_month),
      capturedAt: (src.captured_at as string | null) ?? null,
      sourceDriveFileId: driveId,
      sourceDriveFileName: (src.attestation_drive_file_name as string | null) ?? null,
      octoberAlreadyLinked: already,
      octoberExistingDriveFileId: oct?.attestation_drive_file_id ?? null,
    });
  }

  const wouldCopy = candidates.filter((c) => !c.octoberAlreadyLinked).length;
  const alreadyLinkedOctober = candidates.filter((c) => c.octoberAlreadyLinked).length;

  return {
    dryRun,
    attestationRootFolderId:
      (settings?.drive_attestation_folder_id as string | null) ?? null,
    targetRelativePath: "2026/2026-10",
    candidates,
    counts: {
      sourceWithDrive: candidates.length,
      wouldCopy,
      alreadyLinkedOctober,
      skippedMissingDrive,
    },
  };
}
