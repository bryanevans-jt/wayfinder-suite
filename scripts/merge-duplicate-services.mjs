#!/usr/bin/env node
/**
 * Dry-run / apply helper for merging duplicate service catalog rows and
 * stripping trailing state suffixes like "(GA)" / "(GA) (GA)" from names.
 *
 * Default is dry-run (report only). Pass --apply only after Bryan approves;
 * prefer applying supabase/migrations/20261118120000_merge_duplicate_ga_services.sql.
 *
 * Usage:
 *   node scripts/merge-duplicate-services.mjs
 *   node scripts/merge-duplicate-services.mjs --apply
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

function stripStateSuffixes(name) {
  let out = String(name ?? "").trim();
  while (/\s+\([A-Z]{2}\)\s*$/i.test(out)) {
    out = out.replace(/\s+\([A-Z]{2}\)\s*$/i, "").trim();
  }
  return out;
}

function baseKey(name) {
  return stripStateSuffixes(name).toLowerCase();
}

function hasStateSuffix(name) {
  return /\s+\([A-Z]{2}\)\s*$/i.test(String(name ?? "").trim());
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

async function reportDuplicate(canonical, dup) {
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

  return [
    `  Duplicate: ${dup.name} (${dup.id})`,
    `    clients.current_service_id → move: ${clients}`,
    `    service_episodes.service_id → move: ${episodes}`,
    `    service_milestones → delete after remap: ${milestones}`,
    `    client_meeting_requests.service_id → move: ${meetings}`,
    `    client_stage_events (via milestones) → remap: ${stageEvents}`,
    `    es_time_entries via episodes (ids unchanged): ${timeEntries}`,
    `    contact_logs via episodes (ids unchanged): ${contactLogs}`,
    `    applications via episodes (ids unchanged): ${applications}`,
    `    org_kra_billable_settings.rules service_ids → rewrite: ${kraRefs}`,
    `    ijp_billing_settings.ga_ijp_service_id → move: ${ijpSettings}`,
  ].join("\n");
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

/** After merges, these ids would remain and may still need a rename. */
const survivingIds = new Set((services ?? []).map((s) => s.id));
for (const group of duplicateGroups) {
  for (const dup of group.duplicates) survivingIds.delete(dup.id);
}

const plannedRenames = (services ?? [])
  .filter((s) => survivingIds.has(s.id))
  .map((s) => {
    const next = stripStateSuffixes(s.name);
    return { id: s.id, from: s.name, to: next, changes: s.name.trim() !== next };
  })
  .filter((r) => r.changes);

console.log(APPLY ? "MODE: APPLY" : "MODE: DRY-RUN (report only)");
console.log(`Found ${duplicateGroups.length} duplicate group(s) to merge.`);
console.log(`Found ${plannedRenames.length} planned rename(s) after merge.\n`);

if (duplicateGroups.length === 0 && plannedRenames.length === 0) {
  console.log("Nothing to do — no duplicate groups and no state suffixes left.");
  process.exit(0);
}

for (const group of duplicateGroups) {
  console.log(
    `MERGE group → keep canonical id ${group.canonical.id}\n` +
      `  Canonical (pre-rename): ${group.canonical.name}\n` +
      `  Will rename canonical to: ${stripStateSuffixes(group.canonical.name)}`
  );
  for (const dup of group.duplicates) {
    console.log(await reportDuplicate(group.canonical, dup));
  }
  console.log("");
}

console.log("PLANNED RENAMES (survivors; strip trailing state suffixes):");
if (plannedRenames.length === 0) {
  console.log("  (none)");
} else {
  for (const r of plannedRenames) {
    console.log(`  ${r.from}  →  ${r.to}  [${r.id}]`);
  }
}
console.log("");

if (!APPLY) {
  console.log(
    "Dry-run complete. Review merges + renames above, then apply the migration SQL after Bryan approves."
  );
  process.exit(0);
}

console.error(
  "--apply via this script is disabled for safety. Apply supabase/migrations/20261118120000_merge_duplicate_ga_services.sql instead."
);
process.exit(2);
