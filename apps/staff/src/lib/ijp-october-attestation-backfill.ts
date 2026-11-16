/**
 * One-time October attestation Drive copy + link.
 * Dry-run by default. Execute copies PDFs into attestation root /2026/2026-10
 * and inserts October ijp_monthly_attestations rows. Idempotent; never mutates
 * November source rows or files.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google-mail";
import { sanitizeDriveName } from "@/lib/pre-ets-drive";
import { canManageIjpBillingSettings } from "@wayfinder/supabase/ijp-billing-settings";

export type OctoberAttestationBackfillCandidate = {
  sourceAttestationId: string;
  clientId: string;
  sourceServiceMonth: string;
  capturedAt: string | null;
  captureMethod: "digital" | "upload";
  capturedBy: string | null;
  facilitatorName: string | null;
  signatureDataUrl: string | null;
  sourceDriveFileId: string;
  sourceDriveFileName: string | null;
  octoberAlreadyLinked: boolean;
  octoberExistingDriveFileId: string | null;
};

export type OctoberAttestationBackfillPlan = {
  dryRun: boolean;
  attestationRootFolderId: string | null;
  targetRelativePath: string;
  targetServiceMonth: string;
  candidates: OctoberAttestationBackfillCandidate[];
  /** Unique clients that would be copied (excludes already-linked). */
  toCopy: OctoberAttestationBackfillCandidate[];
  counts: {
    sourceWithDrive: number;
    wouldCopy: number;
    alreadyLinkedOctober: number;
    skippedMissingDrive: number;
  };
};

export type OctoberAttestationBackfillExecuteResult = {
  dryRun: false;
  targetRelativePath: string;
  targetServiceMonth: string;
  copied: number;
  skipped: Array<{ clientId: string; reason: string }>;
  failed: Array<{ clientId: string; reason: string }>;
  copiedClientIds: string[];
};

export type OctoberBackfillDriveOps = {
  ensureTargetFolder: (rootFolderId: string) => Promise<string>;
  copyFile: (opts: {
    sourceFileId: string;
    targetFolderId: string;
    fileName: string;
  }) => Promise<{ fileId: string; fileName: string }>;
};

export const OCTOBER_ATTESTATION_MONTH = "2026-10-01";
export const OCTOBER_ATTESTATION_TARGET_PATH = "2026/2026-10";

const CAPTURE_START = "2026-10-01T00:00:00.000Z";
const CAPTURE_END = "2026-12-01T00:00:00.000Z";

/** Super Admin only — same gate as IJP billing settings. */
export function canRunOctoberAttestationBackfill(
  role: string | null | undefined
): boolean {
  return canManageIjpBillingSettings(role);
}

/**
 * Prefer one source row per client for copy: October service_month first,
 * then earliest capture. Already-linked clients are excluded from toCopy.
 */
export function selectOctoberBackfillCopyTargets(
  candidates: readonly OctoberAttestationBackfillCandidate[]
): OctoberAttestationBackfillCandidate[] {
  const byClient = new Map<string, OctoberAttestationBackfillCandidate>();
  for (const c of candidates) {
    if (c.octoberAlreadyLinked) continue;
    const existing = byClient.get(c.clientId);
    if (!existing) {
      byClient.set(c.clientId, c);
      continue;
    }
    const preferNew =
      (c.sourceServiceMonth === OCTOBER_ATTESTATION_MONTH &&
        existing.sourceServiceMonth !== OCTOBER_ATTESTATION_MONTH) ||
      (c.sourceServiceMonth === existing.sourceServiceMonth &&
        (c.capturedAt ?? "") < (existing.capturedAt ?? ""));
    if (preferNew) byClient.set(c.clientId, c);
  }
  return [...byClient.values()].sort((a, b) =>
    a.clientId.localeCompare(b.clientId)
  );
}

async function ensureOctoberAttestationFolder(rootFolderId: string): Promise<string> {
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });

  async function ensure(parent: string, name: string): Promise<string> {
    const safe = sanitizeDriveName(name);
    const escaped = safe.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const listed = await drive.files.list({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: "allDrives",
      q: `'${parent}' in parents and mimeType='application/vnd.google-apps.folder' and name='${escaped}' and trashed=false`,
      fields: "files(id)",
      pageSize: 1,
    });
    const existing = listed.data.files?.[0]?.id;
    if (existing) return existing;
    const created = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: safe,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parent],
      },
      fields: "id",
    });
    if (!created.data.id) throw new Error(`Could not create folder ${safe}`);
    return created.data.id;
  }

  const yearId = await ensure(rootFolderId, "2026");
  return ensure(yearId, "2026-10");
}

async function copyDriveFileToFolder(opts: {
  sourceFileId: string;
  targetFolderId: string;
  fileName: string;
}): Promise<{ fileId: string; fileName: string }> {
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const fileName = sanitizeDriveName(opts.fileName);
  const copy = await drive.files.copy({
    supportsAllDrives: true,
    fileId: opts.sourceFileId,
    requestBody: {
      name: fileName,
      parents: [opts.targetFolderId],
    },
    fields: "id,name",
  });
  if (!copy.data.id) throw new Error("Drive copy did not return a file id.");
  return { fileId: copy.data.id, fileName: copy.data.name || fileName };
}

export const defaultOctoberBackfillDriveOps: OctoberBackfillDriveOps = {
  ensureTargetFolder: ensureOctoberAttestationFolder,
  copyFile: copyDriveFileToFolder,
};

/**
 * Read-only plan: non-test attestations whose signature was captured in calendar
 * Oct or Nov 2026, with a Drive PDF, for linking/copying into October.
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
      "id, client_id, service_month, captured_at, captured_by, facilitator_name, capture_method, signature_data_url, attestation_drive_file_id, attestation_drive_file_name, is_test"
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
      .eq("service_month", OCTOBER_ATTESTATION_MONTH)
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
    const methodRaw = (src.capture_method as string | null) ?? "digital";
    const captureMethod: "digital" | "upload" =
      methodRaw === "upload" ? "upload" : "digital";
    candidates.push({
      sourceAttestationId: src.id as string,
      clientId: src.client_id as string,
      sourceServiceMonth:
        (src.service_month as string)?.slice?.(0, 10) ?? String(src.service_month),
      capturedAt: (src.captured_at as string | null) ?? null,
      captureMethod,
      capturedBy: (src.captured_by as string | null) ?? null,
      facilitatorName: (src.facilitator_name as string | null) ?? null,
      signatureDataUrl: (src.signature_data_url as string | null) ?? null,
      sourceDriveFileId: driveId,
      sourceDriveFileName: (src.attestation_drive_file_name as string | null) ?? null,
      octoberAlreadyLinked: already,
      octoberExistingDriveFileId: oct?.attestation_drive_file_id ?? null,
    });
  }

  const toCopy = selectOctoberBackfillCopyTargets(candidates);
  const alreadyLinkedOctober = new Set(
    candidates.filter((c) => c.octoberAlreadyLinked).map((c) => c.clientId)
  ).size;

  return {
    dryRun,
    attestationRootFolderId:
      (settings?.drive_attestation_folder_id as string | null) ?? null,
    targetRelativePath: OCTOBER_ATTESTATION_TARGET_PATH,
    targetServiceMonth: OCTOBER_ATTESTATION_MONTH,
    candidates,
    toCopy,
    counts: {
      sourceWithDrive: candidates.length,
      wouldCopy: toCopy.length,
      alreadyLinkedOctober,
      skippedMissingDrive,
    },
  };
}

/**
 * Execute October copy/link. Idempotent: re-checks October link before each
 * client. Never modifies November source rows or Drive files.
 */
export async function executeOctoberAttestationBackfill(
  admin: SupabaseClient,
  opts: {
    actorUserId: string;
    actorName?: string | null;
    driveOps?: OctoberBackfillDriveOps;
  }
): Promise<OctoberAttestationBackfillExecuteResult> {
  const plan = await planOctoberAttestationBackfill(admin, { dryRun: false });
  if (!plan.attestationRootFolderId) {
    throw new Error("Attestation Drive folder is not configured.");
  }

  const driveOps = opts.driveOps ?? defaultOctoberBackfillDriveOps;
  const targetFolderId = await driveOps.ensureTargetFolder(plan.attestationRootFolderId);

  const skipped: OctoberAttestationBackfillExecuteResult["skipped"] = [];
  const failed: OctoberAttestationBackfillExecuteResult["failed"] = [];
  const copiedClientIds: string[] = [];

  for (const c of plan.candidates) {
    if (c.octoberAlreadyLinked) {
      skipped.push({
        clientId: c.clientId,
        reason: "October attestation already linked.",
      });
    }
  }
  // Deduplicate skip reasons per client for already-linked
  const skippedSeen = new Set<string>();
  const skippedUnique = skipped.filter((s) => {
    if (skippedSeen.has(s.clientId)) return false;
    skippedSeen.add(s.clientId);
    return true;
  });

  for (const target of plan.toCopy) {
    try {
      // Re-check idempotency at execute time
      const { data: existingOct } = await admin
        .from("ijp_monthly_attestations")
        .select("id, attestation_drive_file_id")
        .eq("client_id", target.clientId)
        .eq("service_month", OCTOBER_ATTESTATION_MONTH)
        .eq("is_test", false)
        .maybeSingle();
      if (existingOct?.attestation_drive_file_id) {
        skippedUnique.push({
          clientId: target.clientId,
          reason: "October attestation already linked.",
        });
        continue;
      }

      const baseName =
        target.sourceDriveFileName?.trim() ||
        `IJP Attestation - ${target.clientId.slice(0, 8)} - 2026-10.pdf`;
      const fileName = baseName.toLowerCase().endsWith(".pdf")
        ? baseName
        : `${baseName}.pdf`;

      const copied = await driveOps.copyFile({
        sourceFileId: target.sourceDriveFileId,
        targetFolderId,
        fileName,
      });

      const { error: upsertErr } = await admin.from("ijp_monthly_attestations").upsert(
        {
          client_id: target.clientId,
          service_month: OCTOBER_ATTESTATION_MONTH,
          is_test: false,
          attestation_drive_file_id: copied.fileId,
          attestation_drive_file_name: copied.fileName,
          captured_by: target.capturedBy,
          facilitator_name: target.facilitatorName,
          capture_method: target.captureMethod,
          signature_data_url: target.signatureDataUrl,
          captured_at: target.capturedAt ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,service_month,is_test" }
      );
      if (upsertErr) throw new Error(upsertErr.message);

      // Live missing_attestation for October invoices
      await admin
        .from("ijp_billing_invoices")
        .update({
          missing_attestation: false,
          updated_at: new Date().toISOString(),
        })
        .eq("client_id", target.clientId)
        .eq("service_month", OCTOBER_ATTESTATION_MONTH)
        .eq("is_test", false);

      await admin.from("ijp_billing_hour_audit").insert({
        action: "attestation_backfill_plan",
        actor_user_id: opts.actorUserId,
        actor_name: opts.actorName ?? null,
        client_id: target.clientId,
        service_month: OCTOBER_ATTESTATION_MONTH,
        detail: {
          dryRun: false,
          execute: true,
          sourceAttestationId: target.sourceAttestationId,
          sourceServiceMonth: target.sourceServiceMonth,
          sourceDriveFileId: target.sourceDriveFileId,
          copiedDriveFileId: copied.fileId,
          copiedDriveFileName: copied.fileName,
        },
      });

      copiedClientIds.push(target.clientId);
    } catch (e) {
      failed.push({
        clientId: target.clientId,
        reason: e instanceof Error ? e.message : "Copy/link failed.",
      });
    }
  }

  await admin.from("ijp_billing_hour_audit").insert({
    action: "attestation_backfill_plan",
    actor_user_id: opts.actorUserId,
    actor_name: opts.actorName ?? null,
    service_month: OCTOBER_ATTESTATION_MONTH,
    detail: {
      dryRun: false,
      execute: true,
      summary: true,
      copied: copiedClientIds.length,
      skipped: skippedUnique.length,
      failed: failed.length,
    },
  });

  return {
    dryRun: false,
    targetRelativePath: plan.targetRelativePath,
    targetServiceMonth: OCTOBER_ATTESTATION_MONTH,
    copied: copiedClientIds.length,
    skipped: skippedUnique,
    failed,
    copiedClientIds,
  };
}
