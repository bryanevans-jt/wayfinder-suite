#!/usr/bin/env node
/**
 * Dry-run planner for October attestation Drive copy/link (counts only).
 * Prefer the Super Admin control on IJP Billing for preview → confirm → Run.
 * This CLI never executes Drive copies (use the staff UI after merge).
 *
 * Usage:
 *   node scripts/ijp-october-attestation-backfill.mjs
 *   node scripts/ijp-october-attestation-backfill.mjs --json
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_URL).
 * Prints counts only (no client names).
 */

import { createClient } from "@supabase/supabase-js";

const CAPTURE_START = "2026-10-01T00:00:00.000Z";
const CAPTURE_END = "2026-12-01T00:00:00.000Z";
const OCTOBER_MONTH = "2026-10-01";

const args = new Set(process.argv.slice(2));
const wantJson = args.has("--json");

if (args.has("--execute") || args.has("--confirm-execute")) {
  console.error(
    "CLI execute is disabled. Use Super Admin → IJP Billing → Copy Oct/Nov signatures to October 2026."
  );
  process.exit(2);
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });

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
  .lt("captured_at", CAPTURE_END);
if (error) {
  console.error(error.message);
  process.exit(1);
}

const clientIds = [...new Set((sources ?? []).map((s) => s.client_id).filter(Boolean))];
const octoberByClient = new Map();
if (clientIds.length > 0) {
  const { data: octRows } = await admin
    .from("ijp_monthly_attestations")
    .select("client_id, attestation_drive_file_id")
    .eq("service_month", OCTOBER_MONTH)
    .eq("is_test", false)
    .in("client_id", clientIds);
  for (const row of octRows ?? []) {
    octoberByClient.set(row.client_id, row.attestation_drive_file_id);
  }
}

const clientsToCopy = new Set();
let alreadyLinkedOctober = 0;
let skippedMissingDrive = 0;
for (const src of sources ?? []) {
  const driveId = (src.attestation_drive_file_id || "").trim();
  if (!driveId) {
    skippedMissingDrive += 1;
    continue;
  }
  if (octoberByClient.get(src.client_id)) {
    alreadyLinkedOctober += 1;
    continue;
  }
  clientsToCopy.add(src.client_id);
}

const counts = {
  sourceWithDrive: (sources ?? []).filter((s) => s.attestation_drive_file_id).length,
  wouldCopy: clientsToCopy.size,
  alreadyLinkedOctober: new Set(
    (sources ?? [])
      .filter((s) => s.attestation_drive_file_id && octoberByClient.get(s.client_id))
      .map((s) => s.client_id)
  ).size,
  skippedMissingDrive,
};

const report = {
  dryRun: true,
  targetRelativePath: "2026/2026-10",
  attestationRootConfigured: Boolean(settings?.drive_attestation_folder_id),
  counts,
};

if (wantJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("IJP October attestation backfill — DRY RUN (counts only)");
  console.log(`  target: ${report.targetRelativePath}`);
  console.log(`  attestation root configured: ${report.attestationRootConfigured}`);
  console.log(`  sourceWithDrive: ${counts.sourceWithDrive}`);
  console.log(`  wouldCopy: ${counts.wouldCopy}`);
  console.log(`  alreadyLinkedOctober: ${counts.alreadyLinkedOctober}`);
  console.log(`  skippedMissingDrive: ${counts.skippedMissingDrive}`);
  console.log("  Execute via Super Admin IJP Billing UI after merge (not this CLI).");
}
