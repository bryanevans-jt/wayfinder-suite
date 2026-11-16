#!/usr/bin/env node
/**
 * One-time October attestation Drive copy/link planner.
 * Dry-run by default. Does NOT copy Drive files or write rows unless
 * --execute --confirm-execute are both passed (operator-only; not used in PR).
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
const execute = args.has("--execute") && args.has("--confirm-execute");

if (args.has("--execute") && !args.has("--confirm-execute")) {
  console.error("Refusing execute without --confirm-execute.");
  process.exit(2);
}

if (execute) {
  console.error(
    "Execute path is intentionally not implemented in this script build. Dry-run only."
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

let wouldCopy = 0;
let alreadyLinkedOctober = 0;
let skippedMissingDrive = 0;
for (const src of sources ?? []) {
  const driveId = (src.attestation_drive_file_id || "").trim();
  if (!driveId) {
    skippedMissingDrive += 1;
    continue;
  }
  if (octoberByClient.get(src.client_id)) alreadyLinkedOctober += 1;
  else wouldCopy += 1;
}

const counts = {
  sourceWithDrive: (sources ?? []).filter((s) => s.attestation_drive_file_id).length,
  wouldCopy,
  alreadyLinkedOctober,
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
}
