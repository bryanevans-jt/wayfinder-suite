#!/usr/bin/env node
/**
 * Dry-run / apply helper for merging duplicate service catalog rows
 * (bare name vs "(GA)" suffix) into one canonical service.
 *
 * Default is dry-run (report only). Pass --apply to execute the same merges
 * as supabase/migrations/20261118120000_merge_duplicate_ga_services.sql.
 *
 * Usage:
 *   node scripts/merge-duplicate-services.mjs
 *   node scripts/merge-duplicate-services.mjs --apply
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (or the environment). Never run --apply against production without Bryan's
 * explicit approval.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const APPLY = process.argv.includes("--apply");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

const env = {
  ...loadEnvFile(join(root, ".env.local")),
  ...loadEnvFile(join(root, "apps/staff/.env.local")),
  ...process.env,
};

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const STATE_SUFFIX_RE = /\s+\(([A-Z]{2})\)\s*$/i;

function baseKey(name) {
  return name.trim().replace(STATE_SUFFIX_RE, "").trim().toLowerCase();
}

function hasStateSuffix(name) {
  return STATE_SUFFIX_RE.test(name.trim());
}

async function countEq(table, column, id) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, id);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function countIn(table, column, ids) {
  if (ids.length === 0) return 0;
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .in(column, ids);
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function milestoneIdsForService(serviceId) {
  const { data, error } = await admin
    .from("service_milestones")
    .select("id")
    .eq("service_id", serviceId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id);
}

async function episodeIdsForService(serviceId) {
  const { data, error } = await admin
    .from("service_episodes")
    .select("id")
    .eq("service_id", serviceId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.id);
}

async function kraRuleRefs(serviceId) {
  const { data, error } = await admin.from("org_kra_billable_settings").select("rules");
  if (error) throw new Error(error.message);
  let refs = 0;
  for (const row of data ?? []) {
    for (const rule of row.rules ?? []) {
      for (const sid of rule.service_ids ?? []) {
        if (sid === serviceId) refs += 1;
      }
    }
  }
  return refs;
}

async function reportGroup(canonical, duplicates) {
  const lines = [];
  lines.push(`Canonical: ${canonical.name} (${canonical.id})`);
  for (const dup of duplicates) {
    const milestoneIds = await milestoneIdsForService(dup.id);
    const episodeIds = await episodeIdsForService(dup.id);
    const [
      clients,
      episodes,
      milestones,
      meetings,
      stageEvents,
      timeEntries,
      contactLogs,
      applications,
      kraRefs,
      ijpSettings,
    ] = await Promise.all([
      countEq("clients", "current_service_id", dup.id),
      countEq("service_episodes", "service_id", dup.id),
      countEq("service_milestones", "service_id", dup.id),
      countEq("client_meeting_requests", "service_id", dup.id),
      countIn("client_stage_events", "milestone_id", milestoneIds),
      countIn("es_time_entries", "service_episode_id", episodeIds),
      countIn("contact_logs", "service_episode_id", episodeIds),
      countIn("applications", "service_episode_id", episodeIds),
      kraRuleRefs(dup.id),
      countEq("ijp_billing_settings", "ga_ijp_service_id", dup.id),
    ]);

    lines.push(`  Duplicate: ${dup.name} (${dup.id})`);
    lines.push(`    clients.current_service_id → move: ${clients}`);
    lines.push(`    service_episodes.service_id → move: ${episodes}`);
    lines.push(`    service_milestones → delete after remap: ${milestones}`);
    lines.push(`    client_meeting_requests.service_id → move: ${meetings}`);
    lines.push(`    client_stage_events (via milestones) → remap: ${stageEvents}`);
    lines.push(`    es_time_entries via episodes (ids unchanged): ${timeEntries}`);
    lines.push(`    contact_logs via episodes (ids unchanged): ${contactLogs}`);
    lines.push(`    applications via episodes (ids unchanged): ${applications}`);
    lines.push(`    org_kra_billable_settings.rules service_ids → rewrite: ${kraRefs}`);
    lines.push(`    ijp_billing_settings.ga_ijp_service_id → move: ${ijpSettings}`);
  }
  return lines.join("\n");
}

async function applyMerge(canonicalId, duplicateId) {
  // Prefer the SQL function path when available; otherwise fall back to JS steps.
  const { error: rpcError } = await admin.rpc("merge_duplicate_service_by_id", {
    p_canonical_id: canonicalId,
    p_duplicate_id: duplicateId,
  });
  if (!rpcError) return;

  // Function may not exist outside the migration transaction — apply SQL file logic via statements.
  throw new Error(
    `RPC merge_duplicate_service_by_id unavailable (${rpcError.message}). ` +
      `Apply supabase/migrations/20261118120000_merge_duplicate_ga_services.sql instead of --apply via this script.`
  );
}

const { data: services, error } = await admin
  .from("services")
  .select("id, name, state")
  .order("name");
if (error) throw new Error(error.message);

const groups = new Map();
for (const row of services ?? []) {
  const state = String(row.state ?? "").trim().toUpperCase();
  const key = `${baseKey(row.name)}|${state}`;
  const list = groups.get(key) ?? [];
  list.push(row);
  groups.set(key, list);
}

const duplicateGroups = [...groups.entries()]
  .filter(([, rows]) => rows.length > 1)
  .map(([key, rows]) => {
    const sorted = [...rows].sort((a, b) => {
      const as = hasStateSuffix(a.name) ? 0 : 1;
      const bs = hasStateSuffix(b.name) ? 0 : 1;
      if (as !== bs) return as - bs;
      return String(a.id).localeCompare(String(b.id));
    });
    return {
      key,
      canonical: sorted[0],
      duplicates: sorted.slice(1),
    };
  });

console.log(APPLY ? "MODE: APPLY" : "MODE: DRY-RUN (report only)");
console.log(`Found ${duplicateGroups.length} duplicate group(s).\n`);

if (duplicateGroups.length === 0) {
  console.log("No duplicate service groups to merge.");
  process.exit(0);
}

for (const group of duplicateGroups) {
  console.log(await reportGroup(group.canonical, group.duplicates));
  console.log("");
}

if (!APPLY) {
  console.log(
    "Dry-run complete. Review the counts above, then apply the migration SQL (preferred) or re-run with --apply after the merge function exists."
  );
  process.exit(0);
}

for (const group of duplicateGroups) {
  for (const dup of group.duplicates) {
    console.log(`Merging ${dup.name} → ${group.canonical.name}…`);
    await applyMerge(group.canonical.id, dup.id);
  }
}
console.log("Apply complete.");
